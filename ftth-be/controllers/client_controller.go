package controllers

import (
	services "akane/be-ftth/Services"
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

// GetClients mengambil daftar pelanggan dengan pencarian nama, filter router, area FAT, dan status soft-delete (aktif/terputus)
func GetClients(c *fiber.Ctx) error {
	var clients []models.Client

	status := c.Query("status", "active") // active, disconnected, all
	var query *gorm.DB

	if status == "disconnected" {
		query = config.DB.Unscoped().Where("deleted_at IS NOT NULL").Preload("Router").Preload("InternetPackage")
	} else if status == "all" {
		query = config.DB.Unscoped().Preload("Router").Preload("InternetPackage")
	} else {
		// active
		query = config.DB.Preload("Router").Preload("InternetPackage")
	}

	search := c.Query("search", "")
	if search != "" {
		query = query.Where("name LIKE ?", "%"+search+"%")
	}

	routerID := c.Query("router_id", "")
	if routerID != "" {
		query = query.Where("router_id = ?", routerID)
	}

	fat := c.Query("fat", "")
	if fat != "" {
		query = query.Where("fat LIKE ?", "%"+fat+"%")
	}

	if err := query.Order("name ASC").Find(&clients).Error; err != nil {
		return utils.Error(c, "Gagal memuat daftar pelanggan: "+err.Error())
	}

	return utils.Success(c, "Berhasil memuat daftar pelanggan", clients)
}

// GetClient mengambil satu data pelanggan (termasuk yang soft deleted)
func GetClient(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID pelanggan tidak valid.")
	}

	var client models.Client
	if err := config.DB.Unscoped().Preload("Router").Preload("InternetPackage").First(&client, "client_id = ?", id).Error; err != nil {
		return utils.Failed(c, "Pelanggan tidak ditemukan.")
	}

	return utils.Success(c, "Berhasil memuat detail pelanggan", client)
}

// CreateClient membuat data pelanggan baru dengan opsi upload foto rumah
func CreateClient(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	name := c.FormValue("name", "")
	if name == "" {
		return utils.Failed(c, "Nama pelanggan wajib diisi.")
	}

	phone := c.FormValue("phone", "")
	address := c.FormValue("address", "")
	routerID := c.FormValue("router_id", "")
	fat := c.FormValue("fat", "")
	packageIDStr := c.FormValue("package_id", "")
	latitudeStr := c.FormValue("latitude", "0")
	longitudeStr := c.FormValue("longitude", "0")
	ipAddress := c.FormValue("ip_address", "")
	onuSN := c.FormValue("onu_sn", "")
	pppoeUsername := c.FormValue("pppoe_username", "")
	pppoePassword := c.FormValue("pppoe_password", "")
	pppoeProfile := c.FormValue("pppoe_profile", "")
	syncMikrotik := c.FormValue("sync_mikrotik", "false")

	latitude, _ := strconv.ParseFloat(latitudeStr, 64)
	longitude, _ := strconv.ParseFloat(longitudeStr, 64)

	// Auto-correct coordinates if swapped (latitude must be between -90 and 90)
	if latitude < -90 || latitude > 90 {
		if longitude >= -90 && longitude <= 90 {
			latitude, longitude = longitude, latitude
		}
	}

	// Validasi Router
	if routerID != "" {
		var router models.Router
		if err := config.DB.First(&router, "router_id = ?", routerID).Error; err != nil {
			return utils.Failed(c, "Router terpilih tidak ditemukan.")
		}
	}

	// Parse & Validasi Paket Internet
	var packageID *int
	var packageName string
	if packageIDStr != "" {
		pID, err := strconv.Atoi(packageIDStr)
		if err == nil {
			var pkg models.Internetpackage
			if err := config.DB.First(&pkg, "package_id = ? AND is_deleted = 0", pID).Error; err == nil {
				packageID = &pID
				packageName = pkg.PackageName
			}
		}
	}

	housePhotoPath := ""
	file, err := c.FormFile("house_photo")
	if err == nil && file != nil {
		uploadDir := "./uploads/house_photos"
		if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
			return utils.Error(c, "Gagal membuat folder penyimpanan foto.")
		}

		ext := filepath.Ext(file.Filename)
		newFileName := fmt.Sprintf("house_%d_%s%s", time.Now().UnixNano(), uuid.New().String()[:8], ext)
		housePhotoPath = "/uploads/house_photos/" + newFileName

		src, err := file.Open()
		if err != nil {
			return utils.Error(c, "Gagal membuka file unggahan.")
		}
		defer src.Close()

		dst, err := os.Create(filepath.Join(uploadDir, newFileName))
		if err != nil {
			return utils.Error(c, "Gagal menyimpan file foto.")
		}
		defer dst.Close()

		if _, err := io.Copy(dst, src); err != nil {
			return utils.Error(c, "Gagal menulis file foto.")
		}
	}

	localAddr := ""
	var ipPoolID *int
	if ipAddress != "" {
		var pools []models.IPPool
		config.DB.Find(&pools)
		for _, p := range pools {
			_, ipnet, _ := net.ParseCIDR(p.Subnet)
			ip := net.ParseIP(ipAddress)
			if ipnet != nil && ipnet.Contains(ip) {
				localAddr = p.Gateway
				poolIdCopy := p.ID
				ipPoolID = &poolIdCopy
				break
			}
		}
	}

	client := models.Client{
		Name:          name,
		Phone:         phone,
		Address:       address,
		HousePhoto:    housePhotoPath,
		RouterID:      routerID,
		Fat:           fat,
		PackageID:     packageID,
		Latitude:      latitude,
		Longitude:     longitude,
		IPAddress:     ipAddress,
		IPPoolID:      ipPoolID,
		OnuSN:         onuSN,
		PppoeUsername: pppoeUsername,
		PppoePassword: pppoePassword,
		PppoeProfile:  pppoeProfile,
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&client).Error; err != nil {
			return err
		}

		// SINKRONISASI CRM -> MAP (Jika titik koordinat dipetakan, daftarkan otomatis di Map)
		if latitude != 0 && longitude != 0 {
			node := models.NetworkNode{
				Name:        name,
				Type:        models.TypeClient,
				Latitude:    latitude,
				Longitude:   longitude,
				Description: address,
				Status:      "ONLINE",
			}
			if routerID != "" {
				parsedUUID, err := uuid.Parse(routerID)
				if err == nil {
					node.LinkedRouterID = &parsedUUID
				}
			}
			if err := tx.Create(&node).Error; err != nil {
				return err
			}

			clientNode := models.ClientNode{
				NodeID:        node.NodeID,
				SubscriberID:  strconv.Itoa(client.ClientID),
				PacketName:    packageName,
				IPAddress:     ipAddress,
				OnuSN:         onuSN,
				PppoeUsername: pppoeUsername,
			}
			if err := tx.Create(&clientNode).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return utils.Error(c, "Gagal menyimpan data pelanggan: "+err.Error())
	}

	msg := "Pelanggan berhasil ditambahkan."
	if syncMikrotik == "true" && pppoeUsername != "" && pppoePassword != "" && routerID != "" {
		var router models.Router
		if err := config.DB.First(&router, "router_id = ?", routerID).Error; err == nil {
			decryptedPass, _ := utils.DecryptAES(router.RouterPassword)

			prof := pppoeProfile
			if prof == "" {
				prof = "default"
			}

			errMikrotik := services.CreateOrUpdatePPPoESecret(
				router.RouterAddress,
				router.RouterPort,
				router.RouterUsername,
				decryptedPass,
				router.RouterRemoteType,
				pppoeUsername,
				pppoePassword,
				prof,
				ipAddress,
				localAddr,
			)
			if errMikrotik != nil {
				log.Println("Gagal sinkronisasi Mikrotik:", errMikrotik)
				msg += " (Peringatan: Gagal sinkron Mikrotik - " + errMikrotik.Error() + ")"
			}
		} else {
			msg += " (Peringatan: Router tidak ditemukan untuk sinkronisasi)"
		}
	}

	utils.CreateLog(adminPelaku, "CLIENT", "INFO", fmt.Sprintf("Membuat pelanggan baru: %s di area FAT: %s", name, fat))
	return utils.Success(c, msg, client)
}

// UpdateClient memperbarui data pelanggan beserta foto rumah
func UpdateClient(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID pelanggan tidak valid.")
	}

	var client models.Client
	if err := config.DB.Unscoped().First(&client, "client_id = ?", id).Error; err != nil {
		return utils.Failed(c, "Pelanggan tidak ditemukan.")
	}

	name := c.FormValue("name", "")
	if name == "" {
		return utils.Failed(c, "Nama pelanggan wajib diisi.")
	}

	phone := c.FormValue("phone", "")
	address := c.FormValue("address", "")
	routerID := c.FormValue("router_id", "")
	fat := c.FormValue("fat", "")
	packageIDStr := c.FormValue("package_id", "")
	latitudeStr := c.FormValue("latitude", "0")
	longitudeStr := c.FormValue("longitude", "0")
	ipAddress := c.FormValue("ip_address", "")
	onuSN := c.FormValue("onu_sn", "")
	pppoeUsername := c.FormValue("pppoe_username", "")
	pppoePassword := c.FormValue("pppoe_password", "")
	pppoeProfile := c.FormValue("pppoe_profile", "")
	syncMikrotik := c.FormValue("sync_mikrotik", "false")

	latitude, _ := strconv.ParseFloat(latitudeStr, 64)
	longitude, _ := strconv.ParseFloat(longitudeStr, 64)

	// Auto-correct coordinates if swapped (latitude must be between -90 and 90)
	if latitude < -90 || latitude > 90 {
		if longitude >= -90 && longitude <= 90 {
			latitude, longitude = longitude, latitude
		}
	}

	if routerID != "" {
		var router models.Router
		if err := config.DB.First(&router, "router_id = ?", routerID).Error; err != nil {
			return utils.Failed(c, "Router terpilih tidak ditemukan.")
		}
	}

	// Parse & Validasi Paket Internet
	var packageID *int
	var packageName string
	if packageIDStr != "" {
		pID, err := strconv.Atoi(packageIDStr)
		if err == nil {
			var pkg models.Internetpackage
			if err := config.DB.First(&pkg, "package_id = ? AND is_deleted = 0", pID).Error; err == nil {
				packageID = &pID
				packageName = pkg.PackageName
			}
		}
	}

	housePhotoPath := client.HousePhoto
	file, err := c.FormFile("house_photo")
	if err == nil && file != nil {
		uploadDir := "./uploads/house_photos"
		if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
			return utils.Error(c, "Gagal membuat folder penyimpanan foto.")
		}

		if client.HousePhoto != "" {
			oldPath := "." + client.HousePhoto
			_ = os.Remove(oldPath)
		}

		ext := filepath.Ext(file.Filename)
		newFileName := fmt.Sprintf("house_%d_%s%s", time.Now().UnixNano(), uuid.New().String()[:8], ext)
		housePhotoPath = "/uploads/house_photos/" + newFileName

		src, err := file.Open()
		if err != nil {
			return utils.Error(c, "Gagal membuka file unggahan.")
		}
		defer src.Close()

		dst, err := os.Create(filepath.Join(uploadDir, newFileName))
		if err != nil {
			return utils.Error(c, "Gagal menyimpan file foto.")
		}
		defer dst.Close()

		if _, err := io.Copy(dst, src); err != nil {
			return utils.Error(c, "Gagal menulis file foto.")
		}
	}

	localAddr := ""
	var ipPoolID *int
	if ipAddress != "" {
		var pools []models.IPPool
		config.DB.Find(&pools)
		for _, p := range pools {
			_, ipnet, _ := net.ParseCIDR(p.Subnet)
			ip := net.ParseIP(ipAddress)
			if ipnet != nil && ipnet.Contains(ip) {
				localAddr = p.Gateway
				poolIdCopy := p.ID
				ipPoolID = &poolIdCopy
				break
			}
		}
	}

	client.Name = name
	client.Phone = phone
	client.Address = address
	client.RouterID = routerID
	client.Fat = fat
	client.PackageID = packageID
	client.Latitude = latitude
	client.Longitude = longitude
	client.HousePhoto = housePhotoPath
	client.IPAddress = ipAddress
	client.IPPoolID = ipPoolID
	client.OnuSN = onuSN
	client.PppoeUsername = pppoeUsername

	if pppoePassword != "" {
		client.PppoePassword = pppoePassword
	}
	if pppoeProfile != "" {
		client.PppoeProfile = pppoeProfile
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&client).Error; err != nil {
			return err
		}

		// SINKRONISASI CRM -> MAP (Update node peta yang berelasi jika ada, jika belum ada buat baru)
		subID := strconv.Itoa(client.ClientID)
		var clientNode models.ClientNode
		if err := tx.Where("subscriber_id = ?", subID).First(&clientNode).Error; err == nil {
			// Update Node Terkait
			var node models.NetworkNode
			if err := tx.First(&node, clientNode.NodeID).Error; err == nil {
				node.Name = name
				node.Latitude = latitude
				node.Longitude = longitude
				node.Description = address
				if routerID != "" {
					parsedUUID, err := uuid.Parse(routerID)
					if err == nil {
						node.LinkedRouterID = &parsedUUID
					}
				} else {
					node.LinkedRouterID = nil
				}
				tx.Save(&node)
			}
			clientNode.PacketName = packageName
			clientNode.IPAddress = ipAddress
			clientNode.OnuSN = onuSN
			clientNode.PppoeUsername = pppoeUsername
			tx.Save(&clientNode)
		} else if latitude != 0 && longitude != 0 {
			// Buat baru jika belum dipetakan
			node := models.NetworkNode{
				Name:        name,
				Type:        models.TypeClient,
				Latitude:    latitude,
				Longitude:   longitude,
				Description: address,
				Status:      "ONLINE",
			}
			if routerID != "" {
				parsedUUID, err := uuid.Parse(routerID)
				if err == nil {
					node.LinkedRouterID = &parsedUUID
				}
			}
			if err := tx.Create(&node).Error; err != nil {
				return err
			}

			newClientNode := models.ClientNode{
				NodeID:        node.NodeID,
				SubscriberID:  subID,
				PacketName:    packageName,
				IPAddress:     ipAddress,
				OnuSN:         onuSN,
				PppoeUsername: pppoeUsername,
			}
			if err := tx.Create(&newClientNode).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return utils.Error(c, "Gagal memperbarui data pelanggan: "+err.Error())
	}

	msg := "Data pelanggan berhasil diperbarui."
	if syncMikrotik == "true" {
		log.Printf("DEBUG: syncMikrotik=true, username=%s, pass=%s, routerID=%s\n", client.PppoeUsername, client.PppoePassword, routerID)
		if client.PppoeUsername != "" && client.PppoePassword != "" && routerID != "" {
			var router models.Router
			if err := config.DB.First(&router, "router_id = ?", routerID).Error; err == nil {
				decryptedPass, _ := utils.DecryptAES(router.RouterPassword)

				profileToUse := client.PppoeProfile
				if profileToUse == "" {
					profileToUse = "default"
				}

				errMikrotik := services.CreateOrUpdatePPPoESecret(
					router.RouterAddress,
					router.RouterPort,
					router.RouterUsername,
					decryptedPass,
					router.RouterRemoteType,
					client.PppoeUsername,
					client.PppoePassword,
					profileToUse,
					client.IPAddress,
					localAddr,
				)
				if errMikrotik != nil {
					log.Println("Gagal sinkronisasi Mikrotik:", errMikrotik)
					msg += " (Peringatan: Gagal sinkron Mikrotik - " + errMikrotik.Error() + ")"
				} else {
					log.Println("Sukses sinkronisasi ke Mikrotik untuk user", client.PppoeUsername)
				}
			} else {
				log.Println("DEBUG: Router tidak ditemukan di DB:", routerID)
				msg += " (Peringatan: Router tidak ditemukan untuk sinkronisasi)"
			}
		} else {
			log.Println("DEBUG: Syarat syncMikrotik tidak terpenuhi (username/pass/router kosong)")
			msg += " (Peringatan: Username/Password PPPoE tidak lengkap)"
		}
	}

	utils.CreateLog(adminPelaku, "CLIENT", "INFO", fmt.Sprintf("Memperbarui data pelanggan ID %d: %s di area FAT: %s", id, name, fat))
	return utils.Success(c, msg, client)
}

// DeleteClient menonaktifkan/memutus pelanggan (Soft Delete) agar bisa direstore kembali
func DeleteClient(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID pelanggan tidak valid.")
	}

	var client models.Client
	if err := config.DB.First(&client, "client_id = ?", id).Error; err != nil {
		return utils.Failed(c, "Pelanggan tidak ditemukan.")
	}

	// NOTE: Foto rumah tidak dihapus fisik saat soft delete agar jika direstore fotonya tetap ada
	if err := config.DB.Delete(&client).Error; err != nil {
		return utils.Error(c, "Gagal menonaktifkan pelanggan: "+err.Error())
	}

	if client.PppoeUsername != "" && client.RouterID != "" {
		var router models.Router
		if err := config.DB.First(&router, "router_id = ?", client.RouterID).Error; err == nil {
			decryptedPass, _ := utils.DecryptAES(router.RouterPassword)
			errMikrotik := services.SetPPPoESecretStatus(
				router.RouterAddress,
				router.RouterPort,
				router.RouterUsername,
				decryptedPass,
				router.RouterRemoteType,
				client.PppoeUsername,
				true,
			)
			if errMikrotik != nil {
				log.Println("Peringatan: Gagal disable PPPoE secret di Mikrotik:", errMikrotik)
			}
		}
	}

	utils.CreateLog(adminPelaku, "CLIENT", "INFO", fmt.Sprintf("Menonaktifkan pelanggan (soft delete): %s", client.Name))
	return utils.Success(c, "Pelanggan berhasil dinonaktifkan (soft delete).", nil)
}

// RestoreClient memulihkan pelanggan yang diputus (soft-deleted) kembali menjadi aktif
func RestoreClient(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID pelanggan tidak valid.")
	}

	var client models.Client
	if err := config.DB.Unscoped().First(&client, "client_id = ?", id).Error; err != nil {
		return utils.Failed(c, "Pelanggan tidak ditemukan.")
	}

	if !client.DeletedAt.Valid {
		return utils.Failed(c, "Pelanggan saat ini sudah aktif.")
	}

	// Memulihkan soft delete di GORM dengan mengosongkan deleted_at
	if err := config.DB.Unscoped().Model(&client).Update("deleted_at", nil).Error; err != nil {
		return utils.Error(c, "Gagal mengaktifkan kembali pelanggan: "+err.Error())
	}

	if client.PppoeUsername != "" && client.RouterID != "" {
		var router models.Router
		if err := config.DB.First(&router, "router_id = ?", client.RouterID).Error; err == nil {
			decryptedPass, _ := utils.DecryptAES(router.RouterPassword)
			errMikrotik := services.SetPPPoESecretStatus(
				router.RouterAddress,
				router.RouterPort,
				router.RouterUsername,
				decryptedPass,
				router.RouterRemoteType,
				client.PppoeUsername,
				false,
			)
			if errMikrotik != nil {
				log.Println("Peringatan: Gagal enable PPPoE secret di Mikrotik:", errMikrotik)
			}
		}
	}

	utils.CreateLog(adminPelaku, "CLIENT", "INFO", fmt.Sprintf("Mengaktifkan kembali pelanggan (restore): %s", client.Name))
	return utils.Success(c, "Pelanggan berhasil diaktifkan kembali.", client)
}

// SyncClientToMikrotik mensinkronisasikan satu pelanggan ke Router Mikrotik
func SyncClientToMikrotik(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID pelanggan tidak valid.")
	}

	var client models.Client
	if err := config.DB.Preload("Router").First(&client, "client_id = ?", id).Error; err != nil {
		return utils.Failed(c, "Pelanggan tidak ditemukan.")
	}

	if client.RouterID == "" || client.Router == nil {
		return utils.Failed(c, "Pelanggan ini belum dihubungkan ke Router manapun.")
	}
	if client.PppoeUsername == "" || client.PppoePassword == "" {
		return utils.Failed(c, "Username atau Password PPPoE kosong. Lengkapi terlebih dahulu.")
	}

	// Cari local address (gateway) dari IP Pool
	localAddr := ""
	if client.IPAddress != "" && client.IPPoolID != nil {
		var pool models.IPPool
		if err := config.DB.First(&pool, "id = ?", *client.IPPoolID).Error; err == nil {
			localAddr = pool.Gateway
		}
	}

	router := client.Router
	decryptedPass, _ := utils.DecryptAES(router.RouterPassword)
	profileToUse := client.PppoeProfile
	if profileToUse == "" {
		profileToUse = "default"
	}

	port := router.RouterPort
	if strings.HasPrefix(router.RouterRemoteType, "REST") {
		port = router.RouterRestPort
	}

	errMikrotik := services.CreateOrUpdatePPPoESecret(
		router.RouterAddress,
		port,
		router.RouterUsername,
		decryptedPass,
		router.RouterRemoteType,
		client.PppoeUsername,
		client.PppoePassword,
		profileToUse,
		client.IPAddress,
		localAddr,
	)

	if errMikrotik != nil {
		return utils.Error(c, "Gagal sinkronisasi ke Mikrotik: "+errMikrotik.Error())
	}

	utils.CreateLog(adminPelaku, "CLIENT", "INFO", fmt.Sprintf("Sukses sinkronisasi PPPoE ke Mikrotik untuk pelanggan %s (%s)", client.Name, client.PppoeUsername))

	return utils.Success(c, "Berhasil disinkronisasi ke Mikrotik.", nil)
}

// ExportClients mengekspor seluruh pelanggan ke file Excel
func ExportClients(c *fiber.Ctx) error {
	var clients []models.Client

	status := c.Query("status", "active")
	var query *gorm.DB

	if status == "disconnected" {
		query = config.DB.Unscoped().Where("deleted_at IS NOT NULL").Preload("Router").Preload("InternetPackage")
	} else if status == "all" {
		query = config.DB.Unscoped().Preload("Router").Preload("InternetPackage")
	} else {
		query = config.DB.Preload("Router").Preload("InternetPackage")
	}

	search := c.Query("search", "")
	if search != "" {
		query = query.Where("name LIKE ?", "%"+search+"%")
	}

	routerID := c.Query("router_id", "")
	if routerID != "" {
		query = query.Where("router_id = ?", routerID)
	}

	fat := c.Query("fat", "")
	if fat != "" {
		query = query.Where("fat LIKE ?", "%"+fat+"%")
	}

	if err := query.Order("name ASC").Find(&clients).Error; err != nil {
		return utils.Error(c, "Gagal mengambil data pelanggan: "+err.Error())
	}

	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			log.Println("Gagal menutup file excel:", err)
		}
	}()

	// Judul Sheet & Headers
	sheetName := "Daftar Pelanggan"
	index, _ := f.NewSheet(sheetName)
	f.SetActiveSheet(index)
	_ = f.DeleteSheet("Sheet1") // Hapus sheet default

	headers := []string{"ID Pelanggan", "Nama Pelanggan", "Nomor Telepon", "Alamat Rumah", "Area FAT", "Paket Internet", "Harga Paket", "Nama Router", "Router ID (Reference)", "Latitude (Lintang)", "Longitude (Bujur)", "IP Address ONT", "SN ONT", "Username PPPoE", "Password PPPoE", "Profile PPPoE", "Sync Mikrotik", "Status", "Tanggal Dibuat"}
	for colIdx, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheetName, cell, h)
	}

	// Set header styling (bold & sky bg)
	style, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"0ea5e9"}, Pattern: 1},
	})
	if err == nil {
		_ = f.SetRowStyle(sheetName, 1, 1, style)
	}

	// Tulis Data
	for rowIdx, client := range clients {
		rName := "Tidak Terhubung"
		rID := ""
		if client.Router != nil {
			rName = client.Router.RouterName
			rID = client.Router.RouterID.String()
		}

		pName := "Belum Pilih Paket"
		pPrice := 0
		if client.InternetPackage != nil {
			pName = client.InternetPackage.PackageName
			pPrice = client.InternetPackage.PackagePrice
		}

		cStatus := "Aktif"
		if client.DeletedAt.Valid {
			cStatus = "Putus (Soft Deleted)"
		}

		row := rowIdx + 2
		_ = f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), client.ClientID)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), client.Name)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), client.Phone)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), client.Address)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), client.Fat)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), pName)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), pPrice)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), rName)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), rID)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), client.Latitude)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), client.Longitude)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("L%d", row), client.IPAddress)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("M%d", row), client.OnuSN)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("N%d", row), client.PppoeUsername)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("O%d", row), client.PppoePassword)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("P%d", row), client.PppoeProfile)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("Q%d", row), "ya")
		_ = f.SetCellValue(sheetName, fmt.Sprintf("R%d", row), cStatus)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("S%d", row), client.CreatedAt.Format("2006-01-02 15:04:05"))
	}

	// Auto-fit kolom width
	cols, _ := f.GetCols(sheetName)
	for colIdx, col := range cols {
		maxLen := 0
		for _, val := range col {
			if len(val) > maxLen {
				maxLen = len(val)
			}
		}
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		colLetter, _, _ := excelize.SplitCellName(cell)
		_ = f.SetColWidth(sheetName, colLetter, colLetter, float64(maxLen+3))
	}

	// Stream ke Response buffer
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=daftar_pelanggan_ftth.xlsx")
	c.Status(http.StatusOK)

	buf, err := f.WriteToBuffer()
	if err != nil {
		return utils.Error(c, "Gagal memproses ekspor Excel.")
	}

	return c.Send(buf.Bytes())
}

// ImportClients mengimpor data pelanggan dari Excel secara massal
// ImportClients mengimpor data pelanggan dari Excel secara massal
func ImportClients(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	file, err := c.FormFile("excel_file")
	if err != nil {
		return utils.Failed(c, "Tidak ada file excel yang dipilih.")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".xlsx" && ext != ".xls" {
		return utils.Failed(c, "Format file tidak valid. Unggah file Excel (.xlsx atau .xls).")
	}

	src, err := file.Open()
	if err != nil {
		return utils.Failed(c, "Gagal membuka file unggahan.")
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return utils.Failed(c, "Gagal membaca isi berkas unggahan.")
	}

	xlFile, err := excelize.OpenReader(strings.NewReader(string(fileBytes)))
	if err != nil {
		return utils.Failed(c, "Format Excel rusak: "+err.Error())
	}
	defer xlFile.Close()

	// Ambil sheet pertama
	sheetName := xlFile.GetSheetName(0)
	rows, err := xlFile.GetRows(sheetName)
	if err != nil || len(rows) < 2 {
		return utils.Failed(c, "Data Excel kosong atau tidak memiliki baris data.")
	}

	// Indeks Kolom Cerdas (Berdasarkan Header)
	colMap := map[string]int{
		"id":             -1,
		"nama":           -1,
		"phone":          -1,
		"alamat":         -1,
		"fat":            -1,
		"paket":          -1,
		"router_id":      -1,
		"latitude":       -1,
		"longitude":      -1,
		"ip_address":     -1,
		"onu_sn":         -1,
		"pppoe_username": -1,
		"pppoe_password": -1,
		"pppoe_profile":  -1,
		"sync_mikrotik":  -1,
	}

	headers := rows[0]
	for idx, h := range headers {
		lh := strings.ToLower(strings.TrimSpace(h))
		if strings.Contains(lh, "id pelanggan") || strings.Contains(lh, "client id") {
			colMap["id"] = idx
		} else if strings.Contains(lh, "nama") || strings.Contains(lh, "client") {
			colMap["nama"] = idx
		} else if strings.Contains(lh, "telepon") || strings.Contains(lh, "phone") || strings.Contains(lh, "kontak") || strings.Contains(lh, "hp") {
			colMap["phone"] = idx
		} else if strings.Contains(lh, "ip") {
			colMap["ip_address"] = idx
		} else if strings.Contains(lh, "alamat") || strings.Contains(lh, "rumah") || (strings.Contains(lh, "address") && !strings.Contains(lh, "ip")) {
			colMap["alamat"] = idx
		} else if strings.Contains(lh, "fat") || strings.Contains(lh, "area") || strings.Contains(lh, "box") || strings.Contains(lh, "odp") {
			colMap["fat"] = idx
		} else if strings.Contains(lh, "paket") || strings.Contains(lh, "packet") || strings.Contains(lh, "plan") || strings.Contains(lh, "internet") {
			colMap["paket"] = idx
		} else if strings.Contains(lh, "router id") || strings.Contains(lh, "router_id") || strings.Contains(lh, "ref") {
			colMap["router_id"] = idx
		} else if strings.Contains(lh, "lat") || strings.Contains(lh, "lintang") {
			colMap["latitude"] = idx
		} else if strings.Contains(lh, "long") || strings.Contains(lh, "bujur") {
			colMap["longitude"] = idx
		} else if strings.Contains(lh, "sn") || strings.Contains(lh, "serial") {
			colMap["onu_sn"] = idx
		} else if strings.Contains(lh, "password") {
			colMap["pppoe_password"] = idx
		} else if strings.Contains(lh, "profile") {
			colMap["pppoe_profile"] = idx
		} else if strings.Contains(lh, "sync") || strings.Contains(lh, "mikrotik") {
			colMap["sync_mikrotik"] = idx
		} else if strings.Contains(lh, "pppoe") || strings.Contains(lh, "username") || strings.Contains(lh, "user") {
			colMap["pppoe_username"] = idx
		}
	}

	// Fallback map default jika tidak terdeteksi via nama
	if colMap["nama"] == -1 && len(headers) > 0 {
		colMap["nama"] = 0
	}
	if colMap["phone"] == -1 && len(headers) > 1 {
		colMap["phone"] = 1
	}
	if colMap["alamat"] == -1 && len(headers) > 2 {
		colMap["alamat"] = 2
	}
	if colMap["fat"] == -1 && len(headers) > 3 {
		colMap["fat"] = 3
	}
	if colMap["paket"] == -1 && len(headers) > 4 {
		colMap["paket"] = 4
	}
	if colMap["router_id"] == -1 && len(headers) > 5 {
		colMap["router_id"] = 5
	}
	if colMap["latitude"] == -1 && len(headers) > 6 {
		colMap["latitude"] = 6
	}
	if colMap["longitude"] == -1 && len(headers) > 7 {
		colMap["longitude"] = 7
	}
	if colMap["ip_address"] == -1 && len(headers) > 8 {
		colMap["ip_address"] = 8
	}
	if colMap["onu_sn"] == -1 && len(headers) > 9 {
		colMap["onu_sn"] = 9
	}
	if colMap["pppoe_username"] == -1 && len(headers) > 10 {
		colMap["pppoe_username"] = 10
	}
	if colMap["pppoe_password"] == -1 && len(headers) > 11 {
		colMap["pppoe_password"] = 11
	}
	if colMap["pppoe_profile"] == -1 && len(headers) > 12 {
		colMap["pppoe_profile"] = 12
	}
	if colMap["sync_mikrotik"] == -1 && len(headers) > 13 {
		colMap["sync_mikrotik"] = 13
	}

	// Load all internet packages to easily map Excel values
	var packages []models.Internetpackage
	config.DB.Where("is_deleted = 0").Find(&packages)
	packageMap := make(map[string]int)
	for _, p := range packages {
		packageMap[strings.ToLower(strings.TrimSpace(p.PackageName))] = p.PackageID
	}

	type ParsedRow struct {
		ClientID        int     `json:"client_id"`
		Name            string  `json:"name"`
		Phone           string  `json:"phone"`
		Address         string  `json:"address"`
		FatVal          string  `json:"fat"`
		PaketVal        string  `json:"paket"`
		RouterID        string  `json:"router_id"`
		Latitude        float64 `json:"latitude"`
		Longitude       float64 `json:"longitude"`
		IpVal           string  `json:"ip_address"`
		SnVal           string  `json:"onu_sn"`
		PppoeVal        string  `json:"pppoe_username"`
		PppoePassVal    string  `json:"pppoe_password"`
		PppoeProfileVal string  `json:"pppoe_profile"`
		ShouldSync      bool    `json:"sync_mikrotik"`
		PackageID       *int    `json:"-"`
	}

	var parsedRows []ParsedRow

	for rIdx := 1; rIdx < len(rows); rIdx++ {
		row := rows[rIdx]
		if len(row) == 0 || (colMap["nama"] != -1 && colMap["nama"] < len(row) && strings.TrimSpace(row[colMap["nama"]]) == "") {
			continue // baris kosong, skip
		}

		name := ""
		if colMap["nama"] != -1 && colMap["nama"] < len(row) {
			name = strings.TrimSpace(row[colMap["nama"]])
		}
		if name == "" {
			continue
		}

		clientID := 0
		if colMap["id"] != -1 && colMap["id"] < len(row) {
			idStr := strings.TrimSpace(row[colMap["id"]])
			clientID, _ = strconv.Atoi(idStr)
		}

		phone := ""
		if colMap["phone"] != -1 && colMap["phone"] < len(row) {
			phone = strings.TrimSpace(row[colMap["phone"]])
		}

		address := ""
		if colMap["alamat"] != -1 && colMap["alamat"] < len(row) {
			address = strings.TrimSpace(row[colMap["alamat"]])
		}

		fatVal := ""
		if colMap["fat"] != -1 && colMap["fat"] < len(row) {
			fatVal = strings.TrimSpace(row[colMap["fat"]])
		}

		paketVal := ""
		if colMap["paket"] != -1 && colMap["paket"] < len(row) {
			paketVal = strings.TrimSpace(row[colMap["paket"]])
		}

		routerID := ""
		if colMap["router_id"] != -1 && colMap["router_id"] < len(row) {
			routerID = strings.TrimSpace(row[colMap["router_id"]])
		}
		if routerID == "" {
			routerID = c.FormValue("default_router_id")
		}

		latitude := 0.0
		if colMap["latitude"] != -1 && colMap["latitude"] < len(row) {
			val := strings.TrimSpace(row[colMap["latitude"]])
			latitude, _ = strconv.ParseFloat(val, 64)
		}

		longitude := 0.0
		if colMap["longitude"] != -1 && colMap["longitude"] < len(row) {
			val := strings.TrimSpace(row[colMap["longitude"]])
			longitude, _ = strconv.ParseFloat(val, 64)
		}

		// Auto-correct coordinates if swapped (latitude must be between -90 and 90)
		if latitude < -90 || latitude > 90 {
			if longitude >= -90 && longitude <= 90 {
				latitude, longitude = longitude, latitude
			}
		}

		var packageID *int
		if paketVal != "" {
			pNameLower := strings.ToLower(paketVal)
			if val, found := packageMap[pNameLower]; found {
				packageID = &val
			} else {
				// Cari substring matching
				for name, id := range packageMap {
					if strings.Contains(pNameLower, name) || strings.Contains(name, pNameLower) {
						packageID = &id
						paketVal = name
						break
					}
				}
			}
		}

		ipVal := ""
		if colMap["ip_address"] != -1 && colMap["ip_address"] < len(row) {
			ipVal = strings.TrimSpace(row[colMap["ip_address"]])
		}

		snVal := ""
		if colMap["onu_sn"] != -1 && colMap["onu_sn"] < len(row) {
			snVal = strings.TrimSpace(row[colMap["onu_sn"]])
		}

		pppoeVal := ""
		if colMap["pppoe_username"] != -1 && colMap["pppoe_username"] < len(row) {
			pppoeVal = strings.TrimSpace(row[colMap["pppoe_username"]])
		}

		pppoePassVal := ""
		if colMap["pppoe_password"] != -1 && colMap["pppoe_password"] < len(row) {
			pppoePassVal = strings.TrimSpace(row[colMap["pppoe_password"]])
		}

		if pppoePassVal == "" {
			randBytes := make([]byte, 6)
			charset := "abcdefghijklmnopqrstuvwxyz1234567890"
			for i := range randBytes {
				randBytes[i] = charset[rand.Intn(len(charset))]
			}
			pppoePassVal = string(randBytes)
		}

		pppoeProfileVal := ""
		if colMap["pppoe_profile"] != -1 && colMap["pppoe_profile"] < len(row) {
			pppoeProfileVal = strings.TrimSpace(row[colMap["pppoe_profile"]])
		}
		if pppoeProfileVal == "" {
			pppoeProfileVal = "default"
		}

		syncVal := ""
		if colMap["sync_mikrotik"] != -1 && colMap["sync_mikrotik"] < len(row) {
			syncVal = strings.ToLower(strings.TrimSpace(row[colMap["sync_mikrotik"]]))
		}
		shouldSync := syncVal == "ya" || syncVal == "yes" || syncVal == "true" || syncVal == "1"
		if c.FormValue("force_sync_mikrotik") == "true" {
			shouldSync = true
		}

		parsedRows = append(parsedRows, ParsedRow{
			ClientID:        clientID,
			Name:            name,
			Phone:           phone,
			Address:         address,
			FatVal:          fatVal,
			PaketVal:        paketVal,
			RouterID:        routerID,
			Latitude:        latitude,
			Longitude:       longitude,
			IpVal:           ipVal,
			SnVal:           snVal,
			PppoeVal:        pppoeVal,
			PppoePassVal:    pppoePassVal,
			PppoeProfileVal: pppoeProfileVal,
			ShouldSync:      shouldSync,
			PackageID:       packageID,
		})
	}

	isPreview := c.FormValue("preview") == "true"
	if isPreview {
		return utils.Success(c, "Preview berhasil dimuat.", parsedRows)
	}

	var importedCount int

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		for _, pr := range parsedRows {
			// Validasi apakah Router ID ada di database
			routerID := pr.RouterID
			if routerID != "" {
				var router models.Router
				if err := tx.First(&router, "router_id = ?", routerID).Error; err != nil {
					routerID = "" // Kosongkan referensi jika router_id tidak valid
				}
			}

			// Cari IP Pool & localAddr (gateway) berdasarkan IP Address pelanggan
			localAddr := ""
			var ipPoolID *int
			if pr.IpVal != "" {
				var pools []models.IPPool
				tx.Find(&pools)
				for _, p := range pools {
					_, ipnet, _ := net.ParseCIDR(p.Subnet)
					ip := net.ParseIP(pr.IpVal)
					if ipnet != nil && ipnet.Contains(ip) {
						localAddr = p.Gateway
						poolIdCopy := p.ID
						ipPoolID = &poolIdCopy
						break
					}
				}
			}

			// Cek apakah client sudah ada (UPSERT Logic)
			var existingClient models.Client
			var errFind error
			isUpdate := false

			if pr.ClientID != 0 {
				errFind = tx.Where("client_id = ?", pr.ClientID).First(&existingClient).Error
			} else if pr.PppoeVal != "" {
				errFind = tx.Where("pppoe_username = ?", pr.PppoeVal).First(&existingClient).Error
			} else if pr.IpVal != "" {
				errFind = tx.Where("ip_address = ?", pr.IpVal).First(&existingClient).Error
			} else {
				// Coba cari berdasarkan nama
				errFind = tx.Where("name = ?", pr.Name).First(&existingClient).Error
			}

			var currentClientID int
			if errFind == nil {
				// UPDATE Client yang sudah ada
				isUpdate = true
				existingClient.Name = pr.Name
				if pr.Phone != "" {
					existingClient.Phone = pr.Phone
				}
				if pr.Address != "" {
					existingClient.Address = pr.Address
				}
				if pr.FatVal != "" {
					existingClient.Fat = pr.FatVal
				}
				if routerID != "" {
					existingClient.RouterID = routerID
				} else {
					routerID = existingClient.RouterID
				}
				if pr.PackageID != nil {
					existingClient.PackageID = pr.PackageID
				}
				if pr.Latitude != 0 {
					existingClient.Latitude = pr.Latitude
				}
				if pr.Longitude != 0 {
					existingClient.Longitude = pr.Longitude
				}
				if pr.IpVal != "" {
					existingClient.IPAddress = pr.IpVal
					existingClient.IPPoolID = ipPoolID
				}
				if pr.SnVal != "" {
					existingClient.OnuSN = pr.SnVal
				}
				if pr.PppoeVal != "" {
					existingClient.PppoeUsername = pr.PppoeVal
				}
				if pr.PppoePassVal != "" {
					existingClient.PppoePassword = pr.PppoePassVal
				}
				if pr.PppoeProfileVal != "" {
					existingClient.PppoeProfile = pr.PppoeProfileVal
				}

				if err := tx.Save(&existingClient).Error; err != nil {
					return err
				}
				currentClientID = existingClient.ClientID
			} else {
				// INSERT Client Baru
				client := models.Client{
					Name:          pr.Name,
					Phone:         pr.Phone,
					Address:       pr.Address,
					Fat:           pr.FatVal,
					RouterID:      routerID,
					PackageID:     pr.PackageID,
					Latitude:      pr.Latitude,
					Longitude:     pr.Longitude,
					IPAddress:     pr.IpVal,
					IPPoolID:      ipPoolID,
					OnuSN:         pr.SnVal,
					PppoeUsername: pr.PppoeVal,
					PppoePassword: pr.PppoePassVal,
					PppoeProfile:  pr.PppoeProfileVal,
				}
				if err := tx.Create(&client).Error; err != nil {
					return err
				}
				currentClientID = client.ClientID
			}

			// SINKRONKAN CRM -> MAP SECARA REAL-TIME PADA SAAT IMPORT EXCEL
			if pr.Latitude != 0 && pr.Longitude != 0 {
				var clientNode models.ClientNode
				var node models.NetworkNode
				nodeExists := false

				if isUpdate {
					if err := tx.Where("subscriber_id = ?", strconv.Itoa(currentClientID)).First(&clientNode).Error; err == nil {
						if err := tx.First(&node, "node_id = ?", clientNode.NodeID).Error; err == nil {
							nodeExists = true
						}
					}
				}

				if nodeExists {
					// Update existing node
					node.Name = pr.Name
					node.Latitude = pr.Latitude
					node.Longitude = pr.Longitude
					node.Description = pr.Address
					if routerID != "" {
						parsedUUID, err := uuid.Parse(routerID)
						if err == nil {
							node.LinkedRouterID = &parsedUUID
						}
					}
					tx.Save(&node)

					clientNode.PacketName = pr.PaketVal
					clientNode.IPAddress = pr.IpVal
					clientNode.OnuSN = pr.SnVal
					clientNode.PppoeUsername = pr.PppoeVal
					tx.Save(&clientNode)
				} else {
					// Insert new node
					newNode := models.NetworkNode{
						Name:        pr.Name,
						Type:        models.TypeClient,
						Latitude:    pr.Latitude,
						Longitude:   pr.Longitude,
						Description: pr.Address,
						Status:      "ONLINE",
					}
					if routerID != "" {
						parsedUUID, err := uuid.Parse(routerID)
						if err == nil {
							newNode.LinkedRouterID = &parsedUUID
						}
					}
					if err := tx.Create(&newNode).Error; err != nil {
						return err
					}

					newClientNode := models.ClientNode{
						NodeID:        newNode.NodeID,
						SubscriberID:  strconv.Itoa(currentClientID),
						PacketName:    pr.PaketVal,
						IPAddress:     pr.IpVal,
						OnuSN:         pr.SnVal,
						PppoeUsername: pr.PppoeVal,
					}
					if err := tx.Create(&newClientNode).Error; err != nil {
						return err
					}
				}
			}

			// Ambil data untuk Mikrotik Sync
			syncUsername := ""
			syncPassword := ""
			syncProfile := ""
			syncIp := ""
			if isUpdate {
				syncUsername = existingClient.PppoeUsername
				syncPassword = existingClient.PppoePassword
				syncProfile = existingClient.PppoeProfile
				syncIp = existingClient.IPAddress
			} else {
				syncUsername = pr.PppoeVal
				syncPassword = pr.PppoePassVal
				syncProfile = pr.PppoeProfileVal
				syncIp = pr.IpVal
			}

			// SINKRONISASI MIKROTIK JIKA DIMINTA
			if pr.ShouldSync && syncUsername != "" && syncPassword != "" && routerID != "" {
				var router models.Router
				if err := tx.First(&router, "router_id = ?", routerID).Error; err == nil {
					decryptedPass, _ := utils.DecryptAES(router.RouterPassword)

					port := router.RouterPort
					if strings.HasPrefix(router.RouterRemoteType, "REST") {
						port = router.RouterRestPort
					}

					errMikrotik := services.CreateOrUpdatePPPoESecret(
						router.RouterAddress,
						port,
						router.RouterUsername,
						decryptedPass,
						router.RouterRemoteType,
						syncUsername,
						syncPassword,
						syncProfile,
						syncIp,
						localAddr,
					)
					if errMikrotik != nil {
						log.Println("Peringatan (Import): Gagal membuat PPPoE Secret di Mikrotik:", errMikrotik)
					}
				}
			}

			importedCount++
		}
		return nil
	})

	if err != nil {
		return utils.Error(c, "Gagal mengimpor pelanggan: "+err.Error())
	}

	utils.CreateLog(adminPelaku, "CLIENT", "INFO", fmt.Sprintf("Sukses mengimpor %d pelanggan dari file Excel", importedCount))
	return utils.Success(c, fmt.Sprintf("Berhasil mengimpor %d pelanggan.", importedCount), nil)
}

func GetClientImportTemplate(c *fiber.Ctx) error {
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			log.Println("Gagal menutup file excel:", err)
		}
	}()

	sheetName := "Template Impor Pelanggan"
	index, _ := f.NewSheet(sheetName)
	f.SetActiveSheet(index)
	_ = f.DeleteSheet("Sheet1") // Hapus sheet default

	headers := []string{
		"Nama Pelanggan",
		"Nomor Telepon",
		"Alamat Rumah",
		"Area FAT",
		"Paket Internet",
		"Router ID",
		"Latitude (Lintang)",
		"Longitude (Bujur)",
		"IP Address ONT",
		"SN ONT",
		"Username PPPoE",
		"Password PPPoE",
		"Profile PPPoE",
		"Sync Mikrotik",
	}

	for colIdx, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheetName, cell, h)
	}

	// Set header styling (bold & sky bg)
	style, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"0ea5e9"}, Pattern: 1},
	})
	if err == nil {
		_ = f.SetRowStyle(sheetName, 1, 1, style)
	}

	// Tulis Data Contoh
	samples := [][]interface{}{
		{"Budi Santoso", "081234567890", "Jl. Anggrek No. 12, Malang", "ODP-MLG-01", "Internet 50 Mbps", "", -7.9839, 112.6214, "192.168.100.15", "ZTEGC1234567", "budi@net", "budi123", "default", "ya"},
		{"Ani Wijaya", "089876543210", "Perum Permata Asri B-4, Malang", "FAT-02", "Internet 100 Mbps", "", -7.9821, 112.6235, "192.168.100.16", "HWTC12345678", "ani@net", "ani123", "default", "ya"},
	}

	for rowIdx, sample := range samples {
		row := rowIdx + 2
		for colIdx, val := range sample {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, row)
			_ = f.SetCellValue(sheetName, cell, val)
		}
	}

	// Auto-fit kolom width
	cols, _ := f.GetCols(sheetName)
	for colIdx, col := range cols {
		maxLen := 0
		for _, val := range col {
			if len(val) > maxLen {
				maxLen = len(val)
			}
		}
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		colLetter, _, _ := excelize.SplitCellName(cell)
		_ = f.SetColWidth(sheetName, colLetter, colLetter, float64(maxLen+4))
	}

	// Stream ke Response buffer
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=template_import_pelanggan_ftth.xlsx")
	c.Status(http.StatusOK)

	buf, err := f.WriteToBuffer()
	if err != nil {
		return utils.Error(c, "Gagal memproses template Excel.")
	}

	return c.Send(buf.Bytes())
}

// GetClientFats mengambil daftar area FAT beserta jumlah pelanggannya
func GetClientFats(c *fiber.Ctx) error {
	var fats []struct {
		Fat   string `json:"fat"`
		Count int    `json:"count"`
	}

	// Mengambil semua FAT beserta jumlahnya (termasuk yang jumlahnya 0 jika memungkinkan, namun dengan join sederhana kita ambil yang ada saja)
	query := `
		SELECT fat, COUNT(client_id) as count 
		FROM clients 
		WHERE fat != '' AND deleted_at IS NULL 
		GROUP BY fat
		
		UNION
		
		SELECT name as fat, 0 as count
		FROM network_nodes
		WHERE type = 'ODP' AND name NOT IN (
			SELECT fat FROM clients WHERE fat != '' AND deleted_at IS NULL
		)
		ORDER BY fat ASC
	`

	if err := config.DB.Raw(query).Scan(&fats).Error; err != nil {
		return utils.Error(c, "Gagal memuat data FAT: "+err.Error())
	}

	return utils.Success(c, "Berhasil memuat daftar FAT", fats)
}
