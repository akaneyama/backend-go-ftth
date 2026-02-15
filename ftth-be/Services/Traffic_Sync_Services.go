package services

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-routeros/routeros"
)

// ==========================================
// JOB 1: TRAFFIC SYNC (Jalan Tiap Jam/Menit)
// ==========================================
func RunTrafficSyncJob() error {
	fmt.Println("[JOB-TRAFFIC] Memulai sinkronisasi traffic...", time.Now())

	var interfaces []models.InterfaceMonitoring
	if err := config.DB.Preload("Router").Where("is_deleted = ?", 0).Find(&interfaces).Error; err != nil {
		return err
	}

	// Grouping per Router
	interfaceMap := make(map[string][]models.InterfaceMonitoring)
	for _, iface := range interfaces {
		interfaceMap[iface.RouterID.String()] = append(interfaceMap[iface.RouterID.String()], iface)
	}

	for _, ifaceList := range interfaceMap {
		if len(ifaceList) == 0 {
			continue
		}
		router := ifaceList[0].Router
		if router.IsDeleted == 1 {
			continue
		}

		pass, err := utils.DecryptAES(router.RouterPassword)
		if err != nil {
			continue
		}

		client, err := connectMikrotik(router.RouterAddress, router.RouterPort, router.RouterUsername, pass, router.RouterRemoteType)
		if err != nil {
			continue
		}

		for _, targetIface := range ifaceList {
			// if targetIface.IsExcluded == 1 {
			// 	continue
			// }
			rx, tx, err := getInterfaceTraffic(client, targetIface.InterfaceName)
			if err != nil {
				continue
			}

			// Alert jika drop dibawah 1Mbps
			if rx < 1000000 || tx < 1000000 {
				go func(rName, iName string, currRx, currTx float64) {
					sendTrafficAlert(rName, iName, currRx, currTx)
				}(router.RouterName, targetIface.InterfaceName, rx, tx)
			}

			// Save DB
			config.DB.Create(&models.InterfaceTraffic{
				InterfaceID:   targetIface.InterfaceID,
				DownloadSpeed: rx,
				UploadSpeed:   tx,
				Timestamp:     time.Now(),
			})
		}
		client.Close()
	}
	fmt.Println("[JOB-TRAFFIC] Selesai.")
	return nil
}

// ==========================================
// JOB 2: PING CHECK (Jalan Tiap 30 Menit)
// ==========================================
func RunPingCheckJob() error {
	fmt.Println("------------------------------------------------")
	fmt.Println("[JOB-PING] Memulai Ping Check...", time.Now().Format("15:04:05"))

	var interfaces []models.InterfaceMonitoring
	if err := config.DB.Preload("Router").Where("is_deleted = ?", 0).Find(&interfaces).Error; err != nil {
		fmt.Println("[JOB-PING] Error DB:", err)
		return err
	}

	if len(interfaces) == 0 {
		return nil
	}

	// Grouping per Router
	interfaceMap := make(map[string][]models.InterfaceMonitoring)
	for _, iface := range interfaces {
		interfaceMap[iface.RouterID.String()] = append(interfaceMap[iface.RouterID.String()], iface)
	}

	// Loop per Router
	for _, ifaceList := range interfaceMap {
		if len(ifaceList) == 0 {
			continue
		}
		router := ifaceList[0].Router

		fmt.Printf("[JOB-PING] Checking Router: %s... ", router.RouterName)

		pass, err := utils.DecryptAES(router.RouterPassword)
		if err != nil {
			fmt.Println("Gagal decrypt password.")
			continue
		}

		client, err := connectMikrotik(router.RouterAddress, router.RouterPort, router.RouterUsername, pass, router.RouterRemoteType)
		if err != nil {
			fmt.Printf("Gagal konek Mikrotik: %v\n", err)
			go sendRouterDownAlert(router.RouterName, err)
			continue
		}

		var reportLines []string
		hasError := false // Flag penentu kirim telegram

		for _, targetIface := range ifaceList {
			if targetIface.IsExcluded == 1 {
				// Opsional: Masukkan ke report sebagai "Skipped" atau abaikan total
				// reportLines = append(reportLines, fmt.Sprintf("⏸️ %s: Excluded", targetIface.InterfaceName))
				continue
			}
			packetLoss, avgRtt, err := pingInterface(client, targetIface.InterfaceName, "1.1.1.1")

			statusIcon := "✅"
			statusText := fmt.Sprintf("%dms", avgRtt)

			if err != nil {
				statusIcon = "❌"
				statusText = "Error Exec"
				hasError = true // Ada masalah!
			} else if packetLoss == 100 {
				statusIcon = "🔴"
				statusText = "RTO (100% Loss)"
				hasError = true // Ada masalah!
			} else if packetLoss > 0 {
				statusIcon = "⚠️"
				statusText = fmt.Sprintf("Loss %d%%", packetLoss)
				hasError = true // Ada masalah!
			} else if avgRtt > 200 {
				statusIcon = "🐢"
				statusText = fmt.Sprintf("High Latency %dms", avgRtt)
				// High Latency opsional mau dianggap error atau tidak
				// hasError = true
			}

			// Simpan baris laporan untuk router ini
			line := fmt.Sprintf("%s %s: %s", statusIcon, targetIface.InterfaceName, statusText)
			reportLines = append(reportLines, line)
		}

		client.Close()

		// LOGIKA PENGIRIMAN:
		// Hanya kirim ke Telegram jika hasError == true
		if hasError {
			fmt.Println(" [ALERT SENT] 🚨 Ditemukan masalah ping.")
			go sendPingReport(router.RouterName, reportLines, hasError)
		} else {
			fmt.Println(" [OK] Semua aman. Tidak kirim notif.")
		}
	}

	fmt.Println("[JOB-PING] Selesai.")
	fmt.Println("------------------------------------------------")
	return nil
}

// ---------------------------------------------------------
// HELPER FUNCTIONS (MIKROTIK & TELEGRAM)
// ---------------------------------------------------------

func connectMikrotik(ip string, port int, user, pass, remoteType string) (*routeros.Client, error) {
	addr := fmt.Sprintf("%s:%d", ip, port)
	if remoteType == "API-SSL" {
		return routeros.DialTLS(addr, user, pass, &tls.Config{InsecureSkipVerify: true})
	}
	return routeros.Dial(addr, user, pass)
}

func getInterfaceTraffic(client *routeros.Client, interfaceName string) (float64, float64, error) {
	cmd := []string{"/interface/monitor-traffic", "=interface=" + interfaceName, "=once=true"}
	reply, err := client.RunArgs(cmd)
	if err != nil {
		return 0, 0, err
	}
	if len(reply.Re) == 0 {
		return 0, 0, fmt.Errorf("no data")
	}

	rx, _ := strconv.ParseFloat(reply.Re[0].Map["rx-bits-per-second"], 64)
	tx, _ := strconv.ParseFloat(reply.Re[0].Map["tx-bits-per-second"], 64)
	return rx, tx, nil
}

// Fungsi PING Mikrotik
func pingInterface(client *routeros.Client, interfaceName, targetIP string) (int, int, error) {

	// Command: /ping address=1.1.1.1 interface=ether1 count=3
	cmd := []string{
		"/ping",
		"=address=" + targetIP,
		"=interface=" + interfaceName,
		"=count=3",
	}

	reply, err := client.RunArgs(cmd)
	if err != nil {
		return 100, 0, err
	}

	// Hitung Statistik
	sent := len(reply.Re)
	received := 0
	totalTime := 0

	for _, re := range reply.Re {
		// Cek apakah ada properti "time" (ms) yang menandakan reply sukses
		timeStr := re.Map["time"] // format: "20ms"
		if timeStr != "" && !strings.Contains(timeStr, "timeout") {
			received++
			// Parse "20ms" -> 20 (int)
			timeVal, _ := strconv.Atoi(strings.TrimSuffix(timeStr, "ms"))
			totalTime += timeVal
		}
	}

	if sent == 0 {
		return 100, 0, fmt.Errorf("ping failed to start")
	}

	packetLoss := ((sent - received) * 100) / sent
	avgRtt := 0
	if received > 0 {
		avgRtt = totalTime / received
	}

	return packetLoss, avgRtt, nil
}

// ---------------------------------------------------------
// TELEGRAM SENDERS
// ---------------------------------------------------------

func sendTelegramMessage(text string) {
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID := os.Getenv("TELEGRAM_CHAT_ID")
	if botToken == "" || chatID == "" {
		return
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	data := url.Values{}
	data.Set("chat_id", chatID)
	data.Set("text", text)
	data.Set("parse_mode", "Markdown")

	http.PostForm(apiURL, data)
}

// Format Pesan Traffic Drop
func sendTrafficAlert(routerName, ifaceName string, rx, tx float64) {
	msg := fmt.Sprintf(
		"⚠️ *TRAFFIC DROP ALERT* ⚠️\n\n"+
			"📡 *%s* (%s)\n"+
			"📉 Traffic < 1 Mbps\n"+
			"⬇️ %.2f Mbps | ⬆️ %.2f Mbps\n"+
			"🕒 %s",
		routerName, ifaceName, rx/1000000, tx/1000000, time.Now().Format("15:04"),
	)
	sendTelegramMessage(msg)
}

// Format Pesan Ping Report (30 Menit)
func sendPingReport(routerName string, lines []string, hasError bool) {
	// Join lines menjadi satu string
	detail := strings.Join(lines, "\n")

	// Tentukan Header berdasarkan hasError
	// Jika hasError = true, judulnya jadi ALERT
	header := "✅ *ROUTINE PING CHECK (30m)* ✅"
	if hasError {
		header = "⚠️ *PING CHECK ALERT / ISSUES* ⚠️"
	}

	msg := fmt.Sprintf(
		"%s\n\n"+
			"📡 *Router:* %s\n"+
			"🎯 *Target:* 1.1.1.1 (Cloudflare)\n\n"+
			"%s\n\n"+
			"🕒 %s",
		header, // Gunakan header dinamis
		routerName,
		detail,
		time.Now().Format("02 Jan 15:04"),
	)

	sendTelegramMessage(msg)
}

func sendRouterDownAlert(routerName string, errReason error) {
	// Judul Pasti Alert karena fungsinya khusus Router Down
	header := "🚨 <b>CRITICAL: ROUTER DISCONNECTED</b> 🚨"

	// Kita gunakan HTML <b> agar aman dari underscore (_) pada nama router
	msg := fmt.Sprintf(
		"%s\n\n"+
			"📡 <b>Router:</b> %s\n"+
			"❌ <b>Status:</b> CONNECTION LOST / DROP\n"+
			"📝 <b>Error:</b> %v\n\n"+
			"🕒 %s",
		header,                            // Masuk ke %s pertama
		routerName,                        // Masuk ke %s kedua
		errReason,                         // Masuk ke %v (menampilkan pesan error)
		time.Now().Format("02 Jan 15:04"), // Masuk ke %s terakhir
	)

	sendTelegramMessage(msg)
}
