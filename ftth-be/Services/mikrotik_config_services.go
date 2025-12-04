package services

import (
	"crypto/tls"
	"fmt"
	"strings"

	"github.com/go-routeros/routeros"
)

// Struct Settingan
type PPPoESettings struct {
	DNS1      string
	DNS2      string
	OnlyOne   string
	QueueType string // Bisa kosong
}

// Struct Resource
type RouterResources struct {
	QueueTypes []string `json:"queue_types"`
}

// ---------------------------------------------------------
// 1. GET RESOURCES (Scan Queue Types)
// ---------------------------------------------------------
func GetRouterResources(ip string, port int, username, password, remoteType string) (*RouterResources, error) {
	address := fmt.Sprintf("%s:%d", ip, port)
	var client *routeros.Client
	var err error

	if remoteType == "API-SSL" {
		tlsConfig := &tls.Config{InsecureSkipVerify: true}
		client, err = routeros.DialTLS(address, username, password, tlsConfig)
	} else {
		client, err = routeros.Dial(address, username, password)
	}
	if err != nil {
		return nil, fmt.Errorf("gagal koneksi: %v", err)
	}
	defer client.Close()

	resources := &RouterResources{}

	// Ambil Queue Type dari /queue/type
	// Kita ambil properti 'name'
	qTypeReply, err := client.Run("/queue/type/print", "=.proplist=name")
	if err == nil {
		for _, re := range qTypeReply.Re {
			if name := re.Map["name"]; name != "" {
				resources.QueueTypes = append(resources.QueueTypes, name)
			}
		}
	}

	return resources, nil
}

// ---------------------------------------------------------
// 2. CONFIGURE PROFILE
// ---------------------------------------------------------
func ConfigureProfileOnRouter(ip string, port int, username, password, remoteType string, configType string, profileName string, rateLimit string, pppSettings PPPoESettings) error {
	address := fmt.Sprintf("%s:%d", ip, port)
	var client *routeros.Client
	var err error

	if remoteType == "API-SSL" {
		tlsConfig := &tls.Config{InsecureSkipVerify: true}
		client, err = routeros.DialTLS(address, username, password, tlsConfig)
	} else {
		client, err = routeros.Dial(address, username, password)
	}
	if err != nil {
		return fmt.Errorf("gagal koneksi ke router: %v", err)
	}
	defer client.Close()

	switch configType {
	case "pppoe":
		return configurePPPoE(client, profileName, rateLimit, pppSettings)
	case "hotspot":
		return configureHotspot(client, profileName, rateLimit)
	default:
		return fmt.Errorf("tipe konfigurasi tidak valid")
	}
}

// LOGIKA PPPOE
func configurePPPoE(client *routeros.Client, name, limit string, settings PPPoESettings) error {
	// Cek Existing
	reply, err := client.Run("/ppp/profile/print", "=.proplist=name")
	if err != nil {
		return fmt.Errorf("gagal cek profile: %v", err)
	}
	for _, re := range reply.Re {
		if re.Map["name"] == name {
			return fmt.Errorf("profile '%s' sudah ada!", name)
		}
	}

	// Susun Command Dasar
	cmdArgs := []string{
		"/ppp/profile/add",
		"=name=" + name,
		"=rate-limit=" + limit,
		"=change-tcp-mss=yes",
	}

	// Setting DNS
	var dnsList []string
	if settings.DNS1 != "" {
		dnsList = append(dnsList, settings.DNS1)
	}
	if settings.DNS2 != "" {
		dnsList = append(dnsList, settings.DNS2)
	}
	if len(dnsList) > 0 {
		cmdArgs = append(cmdArgs, "=dns-server="+strings.Join(dnsList, ","))
	}

	// Setting Only One
	if settings.OnlyOne != "" {
		cmdArgs = append(cmdArgs, "=only-one="+settings.OnlyOne)
	} else {
		cmdArgs = append(cmdArgs, "=only-one=yes")
	}

	_, err = client.RunArgs(cmdArgs)
	if err != nil {
		return fmt.Errorf("gagal add ppp profile: %v", err)
	}
	return nil
}

// LOGIKA HOTSPOT
func configureHotspot(client *routeros.Client, name, limit string) error {
	reply, err := client.Run("/ip/hotspot/user/profile/print", "=.proplist=name")
	if err != nil {
		return fmt.Errorf("gagal cek profile: %v", err)
	}

	for _, re := range reply.Re {
		if re.Map["name"] == name {
			return fmt.Errorf("profile '%s' sudah ada!", name)
		}
	}

	_, err = client.RunArgs([]string{
		"/ip/hotspot/user/profile/add",
		"=name=" + name,
		"=rate-limit=" + limit,
		"=status-autorefresh=1m",
		"=add-mac-cookie=no",
		"=shared-users=unlimited",
	})
	if err != nil {
		return fmt.Errorf("gagal add hotspot profile: %v", err)
	}
	return nil
}
