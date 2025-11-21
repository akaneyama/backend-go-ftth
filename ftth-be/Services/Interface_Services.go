package services

import (
	"crypto/tls"
	"fmt"

	"github.com/go-routeros/routeros"
)

// InterfaceSimple adalah struct ringkas untuk dropdown di Frontend
type InterfaceSimple struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Disabled string `json:"disabled"` // string "true" atau "false" dari API Mikrotik
	Running  string `json:"running"`  // string "true" atau "false" dari API Mikrotik
}

// GetRouterInterfacesList mengambil daftar interface dari router Mikrotik
func GetRouterInterfacesList(ip string, port int, username, password, remoteType string) ([]InterfaceSimple, error) {
	// 1. Format Address
	address := fmt.Sprintf("%s:%d", ip, port)

	var client *routeros.Client
	var err error

	// 2. Buat Koneksi (Logic sama dengan mikrotik_services.go)
	if remoteType == "API-SSL" {
		// Konfigurasi TLS (Skip Verify untuk Self-Signed Cert)
		tlsConfig := &tls.Config{InsecureSkipVerify: true}
		client, err = routeros.DialTLS(address, username, password, tlsConfig)
	} else {
		// Koneksi API Biasa
		client, err = routeros.Dial(address, username, password)
	}

	if err != nil {
		return nil, fmt.Errorf("gagal koneksi ke router: %v", err)
	}
	defer client.Close() // Pastikan koneksi ditutup setelah selesai

	// 3. Eksekusi Perintah ke Mikrotik
	// Command: /interface/print
	// Proplist: Kita hanya minta field name, type, disabled, dan running agar lebih ringan
	reply, err := client.Run("/interface/print", "=.proplist=name,type,disabled,running")

	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data interface: %v", err)
	}

	// 4. Mapping Hasil ke Struct
	var interfaceList []InterfaceSimple

	for _, re := range reply.Re {
		// re.Map berisi data key-value dari respon Mikrotik
		item := InterfaceSimple{
			Name:     re.Map["name"],
			Type:     re.Map["type"],
			Disabled: re.Map["disabled"],
			Running:  re.Map["running"],
		}
		interfaceList = append(interfaceList, item)
	}

	return interfaceList, nil
}
