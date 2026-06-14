package controllers

import (
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"

	"github.com/go-routeros/routeros"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

// Task status in-memory storage
type IsolirTaskResult struct {
	Target  string `json:"target"`
	Status  string `json:"status"` // SUCCESS, SKIP, FAILED
	Message string `json:"message"`
}

type IsolirTask struct {
	TaskID    string             `json:"task_id"`
	Status    string             `json:"status"` // pending, running, completed, failed
	Progress  int                `json:"progress"`
	Total     int                `json:"total"`
	Results   []IsolirTaskResult `json:"results"`
	CreatedAt time.Time          `json:"created_at"`
}

// Params untuk mendelegasikan router isolir (pilihan/manual)
type IsolirRouterParams struct {
	RouterMode     string       `json:"router_mode"` // auto, selected, manual
	RouterID       string       `json:"router_id"`
	ManualHost     string       `json:"manual_host"`
	ManualPort     int          `json:"manual_port"`
	ManualUsername string       `json:"manual_username"`
	ManualPassword string       `json:"manual_password"`
	ManualUseSSL   bool         `json:"manual_use_ssl"`
	TargetType     string       `json:"target_type"` // auto, hotspot, pppoe
	PrefixRules    []PrefixRule `json:"prefix_rules"`
}

type PrefixRule struct {
	Prefix   string `json:"prefix"`
	RouterID string `json:"router_id"`
}

var (
	tasksMu sync.RWMutex
	tasks   = make(map[string]*IsolirTask)
)

// ToolIsolirUpload memproses unggahan file Excel dan mengembalikan daftar target tanpa memulai isolir
func ToolIsolirUpload(c *fiber.Ctx) error {
	file, err := c.FormFile("excel_file")
	if err != nil {
		return utils.Failed(c, "Tidak ada file yang dipilih.")
	}

	// Cek ekstensi file (.xlsx atau .xls)
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".xlsx" && ext != ".xls" {
		return utils.Failed(c, "Format file tidak valid. Harap unggah file Excel (.xlsx atau .xls).")
	}

	// Buka file excel
	src, err := file.Open()
	if err != nil {
		return utils.Failed(c, "Gagal membaca file unggahan.")
	}
	defer src.Close()

	// Baca ke buffer
	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return utils.Failed(c, "Gagal mengolah file unggahan.")
	}

	// Baca excel dari byte slice
	xlFile, err := excelize.OpenReader(strings.NewReader(string(fileBytes)))
	if err != nil {
		return utils.Failed(c, "Gagal membuka format Excel: "+err.Error())
	}
	defer xlFile.Close()

	// Dapatkan sheet pertama
	sheets := xlFile.GetSheetList()
	if len(sheets) == 0 {
		return utils.Failed(c, "File Excel kosong / tidak memiliki sheet.")
	}
	activeSheet := sheets[0]

	// Baca seluruh baris
	rows, err := xlFile.GetRows(activeSheet)
	if err != nil {
		return utils.Failed(c, "Gagal membaca data baris di Excel.")
	}

	if len(rows) < 2 {
		return utils.Failed(c, "Data Excel minimal harus memiliki baris header dan 1 baris data.")
	}

	// Cari indeks kolom "PPOE"
	// Biasanya di baris ke-1 atau ke-2 (header=1 di python berarti index ke-1, baris ke-2)
	// Kita scan baris 0 sampai 2 untuk menemukan string "PPOE" atau "PPPOE"
	ppoeColIdx := -1
	headerRowFound := -1

	for rIdx := 0; rIdx < len(rows) && rIdx < 3; rIdx++ {
		for cIdx, colVal := range rows[rIdx] {
			cleanVal := strings.ToUpper(strings.TrimSpace(colVal))
			if cleanVal == "PPOE" || cleanVal == "PPPOE" || cleanVal == "PPOE USER" || cleanVal == "IP" || cleanVal == "IP ADDRESS" {
				ppoeColIdx = cIdx
				headerRowFound = rIdx
				break
			}
		}
		if ppoeColIdx != -1 {
			break
		}
	}

	// Jika tidak ketemu kolom PPOE, default ke kolom indeks ke-0 (kolom pertama)
	if ppoeColIdx == -1 {
		ppoeColIdx = 0
		headerRowFound = 0 // default baris pertama header
	}

	// Kumpulkan list target dari kolom PPOE
	var targetList []string
	startRow := headerRowFound + 1
	for i := startRow; i < len(rows); i++ {
		if ppoeColIdx < len(rows[i]) {
			val := strings.TrimSpace(rows[i][ppoeColIdx])
			if val != "" {
				targetList = append(targetList, val)
			}
		}
	}

	if len(targetList) == 0 {
		return utils.Failed(c, "Tidak ditemukan data target isolir (kolom PPOE) di file Excel.")
	}

	return utils.Success(c, "File berhasil diproses, pratinjau data siap", fiber.Map{
		"targets": targetList,
		"total":   len(targetList),
	})
}

// Request struct untuk memproses isolir
type IsolirProcessReq struct {
	Targets        []string     `json:"targets"`
	RouterMode     string       `json:"router_mode"`
	RouterID       string       `json:"router_id"`
	ManualHost     string       `json:"manual_host"`
	ManualPort     int          `json:"manual_port"`
	ManualUsername string       `json:"manual_username"`
	ManualPassword string       `json:"manual_password"`
	ManualUseSSL   bool         `json:"manual_use_ssl"`
	TargetType     string       `json:"target_type"`
	PrefixRules    []PrefixRule `json:"prefix_rules"`
}

// ToolIsolirProcess memulai isolir berdasarkan array targets yang dikirim
func ToolIsolirProcess(c *fiber.Ctx) error {
	var req IsolirProcessReq
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Format request tidak valid.")
	}

	if len(req.Targets) == 0 {
		return utils.Failed(c, "Daftar target kosong.")
	}

	params := IsolirRouterParams{
		RouterMode:     req.RouterMode,
		RouterID:       req.RouterID,
		ManualHost:     req.ManualHost,
		ManualPort:     req.ManualPort,
		ManualUsername: req.ManualUsername,
		ManualPassword: req.ManualPassword,
		ManualUseSSL:   req.ManualUseSSL,
		TargetType:     req.TargetType,
		PrefixRules:    req.PrefixRules,
	}

	// Buat Task baru
	taskID := uuid.New().String()
	task := &IsolirTask{
		TaskID:    taskID,
		Status:    "pending",
		Progress:  0,
		Total:     len(req.Targets),
		Results:   make([]IsolirTaskResult, 0),
		CreatedAt: time.Now(),
	}

	tasksMu.Lock()
	tasks[taskID] = task
	tasksMu.Unlock()

	// Jalankan pemrosesan di background goroutine
	go runIsolirTask(taskID, req.Targets, params)

	return utils.Success(c, "Tugas isolir berhasil dibuat", fiber.Map{
		"task_id": taskID,
		"total":   len(req.Targets),
	})
}

// ToolIsolirStatus mengembalikan status tugas isolir
func ToolIsolirStatus(c *fiber.Ctx) error {
	taskID := c.Params("task_id")

	tasksMu.RLock()
	task, exists := tasks[taskID]
	tasksMu.RUnlock()

	if !exists {
		return utils.Failed(c, "Tugas isolir tidak ditemukan.")
	}

	return utils.Success(c, "Detail status isolir", task)
}

// runIsolirTask memproses isolir per target di background
func runIsolirTask(taskID string, targets []string, params IsolirRouterParams) {
	tasksMu.Lock()
	task, exists := tasks[taskID]
	if exists {
		task.Status = "running"
	}
	tasksMu.Unlock()

	if !exists {
		return
	}

	// Persiapkan daftar router yang akan digunakan
	var routers []models.Router

	if params.RouterMode == "manual" {
		rType := "API"
		if params.ManualUseSSL {
			rType = "API-SSL"
		}
		routers = append(routers, models.Router{
			RouterName:       "Router Manual (" + params.ManualHost + ")",
			RouterAddress:    params.ManualHost,
			RouterPort:       params.ManualPort,
			RouterUsername:   params.ManualUsername,
			RouterPassword:   params.ManualPassword,
			RouterRemoteType: rType,
		})
	} else if params.RouterMode == "selected" {
		var singleRouter models.Router
		if err := config.DB.Where("is_deleted = 0 AND router_id = ?", params.RouterID).First(&singleRouter).Error; err != nil {
			log.Printf("[ISOLIR TASK] Router terpilih tidak ditemukan: %v", err)
			tasksMu.Lock()
			task.Status = "failed"
			tasksMu.Unlock()
			return
		}
		decryptedPass, errDec := utils.DecryptAES(singleRouter.RouterPassword)
		if errDec == nil {
			singleRouter.RouterPassword = decryptedPass
		}
		routers = append(routers, singleRouter)
	} else {
		// default: auto or prefix (all active routers in DB)
		if err := config.DB.Where("is_deleted = 0").Find(&routers).Error; err != nil {
			log.Printf("[ISOLIR TASK] Gagal mengambil daftar router: %v", err)
			tasksMu.Lock()
			task.Status = "failed"
			tasksMu.Unlock()
			return
		}
		for i := range routers {
			decryptedPass, errDec := utils.DecryptAES(routers[i].RouterPassword)
			if errDec == nil {
				routers[i].RouterPassword = decryptedPass
			}
		}
	}

	// Buka koneksi client ke router
	type RouterConn struct {
		Router *models.Router
		Client *routeros.Client
	}
	var activeConnections []RouterConn

	// Melakukan dial ke router yang terpilih
	for _, r := range routers {
		addr := fmt.Sprintf("%s:%d", r.RouterAddress, r.RouterPort)
		var client *routeros.Client
		var err error

		if r.RouterRemoteType == "API-SSL" {
			tlsConfig := &tls.Config{InsecureSkipVerify: true}
			client, err = routeros.DialTLS(addr, r.RouterUsername, r.RouterPassword, tlsConfig)
		} else {
			client, err = routeros.Dial(addr, r.RouterUsername, r.RouterPassword)
		}

		if err != nil {
			log.Printf("[ISOLIR TASK] Gagal terhubung ke router %s (%s): %v", r.RouterName, addr, err)
			continue
		}

		activeConnections = append(activeConnections, RouterConn{
			Router: &r,
			Client: client,
		})
	}

	// Tutup seluruh koneksi setelah selesai
	defer func() {
		for _, conn := range activeConnections {
			if conn.Client != nil {
				conn.Client.Close()
			}
		}
	}()

	// Proses setiap target
	for idx, rawTarget := range targets {
		// Normalisasi target (bersihkan string static@)
		target := strings.TrimSpace(rawTarget)
		target = strings.ReplaceAll(target, "static@", "")

		result := IsolirTaskResult{
			Target:  rawTarget,
			Status:  "SKIP",
			Message: fmt.Sprintf("Target %s tidak ditemukan di router mana pun.", rawTarget),
		}

		// Tentukan apakah harus diisolir sebagai Hotspot atau PPPoE
		processAsHotspot := false
		processAsPPPoE := false

		if params.TargetType == "hotspot" {
			processAsHotspot = true
		} else if params.TargetType == "pppoe" {
			processAsPPPoE = true
		} else {
			// Auto: Jika format IP, dia Hotspot IP Binding. Jika text, dia PPPoE
			processAsHotspot = (net.ParseIP(target) != nil)
			processAsPPPoE = !processAsHotspot
		}

		foundInRouter := false

		// Tentukan router koneksi yang akan diproses
		var connectionsToSearch []RouterConn
		if params.RouterMode == "prefix" && len(params.PrefixRules) > 0 {
			matched := false
			for _, rule := range params.PrefixRules {
				// Cek apakah target mengandung prefix.
				// Gunakan HasPrefix, dan bersihkan target dari "static@" yang sudah dilakukan di atas.
				if strings.HasPrefix(target, rule.Prefix) {
					matched = true
					for _, conn := range activeConnections {
						if conn.Router.RouterID.String() == rule.RouterID {
							connectionsToSearch = append(connectionsToSearch, conn)
							break
						}
					}
					break
				}
			}
			if !matched {
				// Fallback: Jika tidak cocok dengan prefix apapun, cari di semua router
				connectionsToSearch = activeConnections
			}
		} else {
			connectionsToSearch = activeConnections
		}

		// Cari di koneksi router yang sesuai
		for _, conn := range connectionsToSearch {
			client := conn.Client
			router := conn.Router

			if processAsHotspot {
				// Cek apakah target berupa IP
				isIP := net.ParseIP(target) != nil
				if isIP {
					// A. HOTSPOT IP BINDING
					reply, err := client.Run("/ip/hotspot/ip-binding/print", "?address="+target)
					if err == nil && len(reply.Re) > 0 {
						foundInRouter = true
						binding := reply.Re[0].Map
						bindingID := binding[".id"]
						comment := binding["comment"]
						if comment == "" {
							comment = "Tanpa Keterangan"
						}
						disabled := binding["disabled"] == "true"

						if disabled {
							result.Status = "SKIP"
							result.Message = fmt.Sprintf("[SKIP] Hotspot IP Binding sudah diisolir sebelumnya di Router %s: %s (%s)", router.RouterName, comment, target)
						} else {
							_, errSet := client.Run("/ip/hotspot/ip-binding/set", "=.id="+bindingID, "=disabled=yes")
							if errSet != nil {
								result.Status = "FAILED"
								result.Message = fmt.Sprintf("[GAGAL] Gagal menonaktifkan binding di %s: %v", router.RouterName, errSet)
							} else {
								result.Status = "SUCCESS"
								result.Message = fmt.Sprintf("[OK] Berhasil isolir Hotspot IP Binding di %s: %s (%s)", router.RouterName, comment, target)
							}
						}
						break
					}
				} else {
					// B. HOTSPOT USER ACCOUNT (Bukan IP)
					reply, err := client.Run("/ip/hotspot/user/print", "?name="+target)
					if err == nil && len(reply.Re) > 0 {
						foundInRouter = true
						userMap := reply.Re[0].Map
						userID := userMap[".id"]
						comment := userMap["comment"]
						if comment == "" {
							comment = "Tanpa Keterangan"
						}
						disabled := userMap["disabled"] == "true"

						if disabled {
							result.Status = "SKIP"
							result.Message = fmt.Sprintf("[SKIP] User Hotspot sudah dinonaktifkan di %s: %s (%s)", router.RouterName, comment, target)
						} else {
							_, errSet := client.Run("/ip/hotspot/user/set", "=.id="+userID, "=disabled=yes")
							if errSet != nil {
								result.Status = "FAILED"
								result.Message = fmt.Sprintf("[GAGAL] Gagal menonaktifkan User Hotspot di %s: %v", router.RouterName, errSet)
							} else {
								result.Status = "SUCCESS"
								result.Message = fmt.Sprintf("[OK] Berhasil menonaktifkan User Hotspot di %s: %s (%s)", router.RouterName, comment, target)

								// Tendang sesi aktif user hotspot agar putus instan
								activeReply, errAct := client.Run("/ip/hotspot/active/print", "?user="+target)
								if errAct == nil && len(activeReply.Re) > 0 {
									actID := activeReply.Re[0].Map[".id"]
									client.Run("/ip/hotspot/active/remove", "=.id="+actID)
								}
							}
						}
						break
					}
				}
			}

			if processAsPPPoE {
				// C. PPPOE SECRET
				// Jika target berupa IP, kita cari berdasarkan remote-address. Jika tidak, cari berdasarkan name
				filterParam := "?name=" + target
				if net.ParseIP(target) != nil {
					filterParam = "?remote-address=" + target
				}

				reply, err := client.Run("/ppp/secret/print", filterParam)
				if err == nil && len(reply.Re) > 0 {
					foundInRouter = true
					secret := reply.Re[0].Map
					secretID := secret[".id"]
					secretName := secret["name"]
					comment := secret["comment"]
					if comment == "" {
						comment = "Tanpa Keterangan"
					}
					disabled := secret["disabled"] == "true"

					if disabled {
						result.Status = "SKIP"
						result.Message = fmt.Sprintf("[SKIP] PPPoE sudah diisolir sebelumnya di Router %s: %s (%s)", router.RouterName, comment, secretName)
					} else {
						_, errSet := client.Run("/ppp/secret/set", "=.id="+secretID, "=disabled=yes")
						if errSet != nil {
							result.Status = "FAILED"
							result.Message = fmt.Sprintf("[GAGAL] Gagal menonaktifkan PPPoE di %s: %v", router.RouterName, errSet)
						} else {
							result.Status = "SUCCESS"
							result.Message = fmt.Sprintf("[OK] Berhasil isolir PPPoE di %s: %s (%s)", router.RouterName, comment, secretName)

							// Putuskan koneksi aktif jika ada agar efek instan terasa!
							activeReply, errAct := client.Run("/ppp/active/print", "?name="+secretName)
							if errAct == nil && len(activeReply.Re) > 0 {
								actID := activeReply.Re[0].Map[".id"]
								client.Run("/ppp/active/remove", "=.id="+actID)
							}
						}
					}
					break
				}
			}
		}

		if !foundInRouter {
			// fallback check jika tidak terhubung sama sekali atau benar-benar tidak ditemukan
			if len(activeConnections) == 0 {
				result.Status = "FAILED"
				result.Message = "[GAGAL] Semua router Mikrotik tidak dapat dihubungi atau status OFFLINE."
			}
		}

		// Update Progress Task
		tasksMu.Lock()
		task.Progress = idx + 1
		task.Results = append(task.Results, result)
		tasksMu.Unlock()
	}

	// Selesai
	tasksMu.Lock()
	task.Status = "completed"
	tasksMu.Unlock()
}

// ToolIsolirTemplate menghasilkan file Excel (.xlsx) contoh format template isolir untuk diunduh pengguna
func ToolIsolirTemplate(c *fiber.Ctx) error {
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("Gagal menutup file excelize: %v", err)
		}
	}()

	// Buat sheet baru
	sheetName := "Template Isolir"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return utils.Failed(c, "Gagal membuat sheet template: "+err.Error())
	}
	f.SetActiveSheet(index)

	// Hapus Sheet1 default
	f.DeleteSheet("Sheet1")

	// Set lebar kolom agar rapi
	f.SetColWidth(sheetName, "A", "A", 25)
	f.SetColWidth(sheetName, "B", "B", 30)
	f.SetColWidth(sheetName, "C", "C", 40)

	// Style untuk Header (Light Blue fill, Bold, Center Alignment, Thin Borders)
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
			Size: 11,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E0F2FE"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "CCCCCC", Style: 1},
			{Type: "left", Color: "CCCCCC", Style: 1},
			{Type: "right", Color: "CCCCCC", Style: 1},
			{Type: "bottom", Color: "CCCCCC", Style: 1},
		},
	})
	if err != nil {
		return utils.Failed(c, "Gagal merancang style header: "+err.Error())
	}

	// Style untuk Data Rows (Thin Borders, Left Alignment)
	dataStyle, err := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{
			Vertical: "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "E5E7EB", Style: 1},
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
			{Type: "bottom", Color: "E5E7EB", Style: 1},
		},
	})

	// Tulis Headers
	headers := []string{"PPOE", "NAMA PELANGGAN (OPSIONAL)", "KETERANGAN (OPSIONAL)"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	// Tulis Contoh Data (Guiding Rows)
	sampleData := [][]interface{}{
		{"pelanggan_joko", "Joko Susilo", "Contoh input Username PPPoE"},
		{"10.20.30.40", "Budi Handoko", "Contoh input IP Address Hotspot Binding"},
		{"static@10.20.30.41", "Siti Aminah", "Contoh input IP Static dengan prefix"},
	}

	for rIdx, row := range sampleData {
		for cIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(cIdx+1, rIdx+2)
			f.SetCellValue(sheetName, cell, val)
			f.SetCellStyle(sheetName, cell, cell, dataStyle)
		}
	}

	// Set tinggi baris agar berjarak longgar/premium
	f.SetRowHeight(sheetName, 1, 28)
	for i := 2; i <= len(sampleData)+1; i++ {
		f.SetRowHeight(sheetName, i, 22)
	}

	// Write to Buffer
	buffer, err := f.WriteToBuffer()
	if err != nil {
		return utils.Failed(c, "Gagal menulis excel ke memory buffer: "+err.Error())
	}

	// Stream file download ke client
	c.Set("Content-Disposition", "attachment; filename=template_isolir_batch.xlsx")
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	return c.Send(buffer.Bytes())
}

