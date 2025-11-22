package services

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"crypto/tls"
	"fmt"
	"strconv"
	"time"

	"github.com/go-routeros/routeros"
)

// RunTrafficSyncJob adalah fungsi utama yang akan dipanggil oleh Cron atau Manual Button
func RunTrafficSyncJob() error {
	fmt.Println("[JOB] Memulai sinkronisasi traffic...", time.Now())

	// 1. Ambil semua Interface yang dimonitor (yang tidak dihapus)
	// Kita Preload Router karena butuh IP/User/Pass router induknya
	var interfaces []models.InterfaceMonitoring
	if err := config.DB.Preload("Router").Where("is_deleted = ?", 0).Find(&interfaces).Error; err != nil {
		return err
	}

	// 2. Grouping Interface per Router agar kita tidak bolak-balik login router yang sama
	// Map: RouterID -> []InterfaceMonitoring
	interfaceMap := make(map[string][]models.InterfaceMonitoring)
	for _, iface := range interfaces {
		rID := iface.RouterID.String()
		interfaceMap[rID] = append(interfaceMap[rID], iface)
	}

	// 3. Loop per Router
	for _, ifaceList := range interfaceMap {
		if len(ifaceList) == 0 {
			continue
		}

		router := ifaceList[0].Router

		// Skip jika router dihapus/disable (opsional logic)
		if router.IsDeleted == 1 {
			continue
		}

		// Decrypt Password
		pass, err := utils.DecryptAES(router.RouterPassword)
		if err != nil {
			fmt.Printf("[JOB-ERR] Gagal decrypt pass router %s\n", router.RouterName)
			continue
		}

		// Konek ke Mikrotik
		client, err := connectMikrotik(router.RouterAddress, router.RouterPort, router.RouterUsername, pass, router.RouterRemoteType)
		if err != nil {
			fmt.Printf("[JOB-ERR] Gagal konek ke router %s: %v\n", router.RouterName, err)
			continue
		}

		// Loop Interface di router ini
		for _, targetIface := range ifaceList {
			// Ambil Traffic Snapshot
			rx, tx, err := getInterfaceTraffic(client, targetIface.InterfaceName)
			if err != nil {
				fmt.Printf("[JOB-ERR] Gagal ambil traffic %s: %v\n", targetIface.InterfaceName, err)
				continue
			}

			// Simpan ke DB
			trafficLog := models.InterfaceTraffic{
				InterfaceID:   targetIface.InterfaceID,
				DownloadSpeed: rx, // bits per second
				UploadSpeed:   tx, // bits per second
				Timestamp:     time.Now(),
			}
			config.DB.Create(&trafficLog)
		}

		client.Close()
	}

	fmt.Println("[JOB] Sinkronisasi traffic selesai.", time.Now())
	return nil
}

// Helper: Connect Mikrotik
func connectMikrotik(ip string, port int, user, pass, remoteType string) (*routeros.Client, error) {
	addr := fmt.Sprintf("%s:%d", ip, port)
	if remoteType == "API-SSL" {
		return routeros.DialTLS(addr, user, pass, &tls.Config{InsecureSkipVerify: true})
	}
	return routeros.Dial(addr, user, pass)
}

// Helper: Get Traffic Snapshot (Monitor Traffic Once)
func getInterfaceTraffic(client *routeros.Client, interfaceName string) (float64, float64, error) {
	// Command: /interface/monitor-traffic interface=ether1 once=true
	cmd := []string{
		"/interface/monitor-traffic",
		"=interface=" + interfaceName,
		"=once=true",
	}

	reply, err := client.RunArgs(cmd)
	if err != nil {
		return 0, 0, err
	}

	if len(reply.Re) == 0 {
		return 0, 0, fmt.Errorf("no data returned")
	}

	// Mikrotik returns string numbers (e.g. "1500", "0")
	rxStr := reply.Re[0].Map["rx-bits-per-second"]
	txStr := reply.Re[0].Map["tx-bits-per-second"]

	rx, _ := strconv.ParseFloat(rxStr, 64)
	tx, _ := strconv.ParseFloat(txStr, 64)

	return rx, tx, nil
}
