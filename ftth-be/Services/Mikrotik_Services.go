package services

import (
	"crypto/tls"
	"fmt"

	"github.com/go-routeros/routeros"
)

// Struct untuk menampung hasil gabungan
type RouterSystemInfo struct {
	BoardName string `json:"board_name"`
	Model     string `json:"model"`
	Version   string `json:"version"`
	CPU       string `json:"cpu"`
	Uptime    string `json:"uptime"`
	Identity  string `json:"identity"` // Nama router dari /system/identity
}

func GetRouterSystemInfo(ip string, port int, username, password, remoteType string) (*RouterSystemInfo, error) {
	// Format address host:port
	address := fmt.Sprintf("%s:%d", ip, port)

	var client *routeros.Client
	var err error

	// --- PERBAIKAN KONEKSI ---
	if remoteType == "API-SSL" {
		// Konfigurasi TLS agar menerima Self-Signed Certificate
		tlsConfig := &tls.Config{InsecureSkipVerify: true}

		// Gunakan DialTLS untuk koneksi SSL
		client, err = routeros.DialTLS(address, username, password, tlsConfig)
	} else {
		// Gunakan Dial biasa (tanpa parameter timeout, mengikuti default OS)
		client, err = routeros.Dial(address, username, password)
	}

	if err != nil {
		return nil, fmt.Errorf("gagal koneksi ke router: %v", err)
	}
	defer client.Close()

	// 2. Ambil System Resource (Model, Versi, CPU)
	replyResource, err := client.Run("/system/resource/print")
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil resource: %v", err)
	}

	// 3. Ambil System Identity (Nama Router)
	replyIdentity, err := client.Run("/system/identity/print")
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil identity: %v", err)
	}

	// 4. Mapping Data
	info := &RouterSystemInfo{}

	// Mapping Resource
	if len(replyResource.Re) > 0 {
		res := replyResource.Re[0].Map
		info.BoardName = res["board-name"]
		info.Model = res["board-name"]
		info.Version = res["version"]
		info.CPU = res["cpu"]
		info.Uptime = res["uptime"]
	}

	// Mapping Identity
	if len(replyIdentity.Re) > 0 {
		id := replyIdentity.Re[0].Map
		info.Identity = id["name"]
	}

	return info, nil
}
