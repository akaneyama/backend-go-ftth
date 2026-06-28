package services

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/go-routeros/routeros"
)

func makeRestRequest(method, url, username, password string, payload interface{}, insecure bool) ([]byte, error) {
	var bodyReader io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonData)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(username, password)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	transport := &http.Transport{}
	if insecure {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	client := &http.Client{Transport: transport}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}
	return body, err
}

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

// ---------------------------------------------------------
// 3. PPPOE SECRET & PROFILE MANAGEMENT
// ---------------------------------------------------------

func GetPPPoEProfiles(ip string, port int, username, password, remoteType string) ([]string, error) {
	if strings.HasPrefix(remoteType, "REST") {
		protocol := "http"
		if remoteType == "REST-HTTPS" {
			protocol = "https"
		}
		url := fmt.Sprintf("%s://%s:%d/rest/ppp/profile", protocol, ip, port)
		body, err := makeRestRequest("GET", url, username, password, nil, true)
		if err != nil {
			return nil, fmt.Errorf("gagal mengambil ppp profile via REST: %v", err)
		}
		var results []map[string]interface{}
		if err := json.Unmarshal(body, &results); err != nil {
			return nil, err
		}
		var profiles []string
		for _, row := range results {
			if name, ok := row["name"].(string); ok && name != "" {
				profiles = append(profiles, name)
			}
		}
		return profiles, nil
	}

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
		return nil, fmt.Errorf("gagal koneksi ke router: %v", err)
	}
	defer client.Close()

	reply, err := client.Run("/ppp/profile/print", "=.proplist=name")
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil ppp profile: %v", err)
	}

	var profiles []string
	for _, re := range reply.Re {
		if name := re.Map["name"]; name != "" {
			profiles = append(profiles, name)
		}
	}

	return profiles, nil
}

func CheckPPPoESecret(ip string, port int, routerUser, routerPass, remoteType string, username string) (map[string]string, error) {
	if strings.HasPrefix(remoteType, "REST") {
		protocol := "http"
		if remoteType == "REST-HTTPS" {
			protocol = "https"
		}
		url := fmt.Sprintf("%s://%s:%d/rest/ppp/secret?name=%s", protocol, ip, port, username)
		body, err := makeRestRequest("GET", url, routerUser, routerPass, nil, true)
		if err != nil {
			return nil, fmt.Errorf("gagal cek ppp secret via REST: %v", err)
		}
		var results []map[string]interface{}
		if err := json.Unmarshal(body, &results); err != nil {
			return nil, err
		}
		if len(results) > 0 {
			resMap := make(map[string]string)
			for k, v := range results[0] {
				resMap[k] = fmt.Sprintf("%v", v)
			}
			return resMap, nil
		}
		return nil, nil
	}

	address := fmt.Sprintf("%s:%d", ip, port)
	var client *routeros.Client
	var err error

	if remoteType == "API-SSL" {
		tlsConfig := &tls.Config{InsecureSkipVerify: true}
		client, err = routeros.DialTLS(address, routerUser, routerPass, tlsConfig)
	} else {
		client, err = routeros.Dial(address, routerUser, routerPass)
	}
	if err != nil {
		return nil, fmt.Errorf("gagal koneksi ke router: %v", err)
	}
	defer client.Close()

	reply, err := client.Run("/ppp/secret/print", "?name="+username, "=.proplist=name,password,profile,service,remote-address,local-address,disabled")
	if err != nil {
		if !strings.Contains(err.Error(), "!empty") {
			return nil, fmt.Errorf("gagal cek ppp secret: %v", err)
		}
	}

	if reply != nil && len(reply.Re) > 0 {
		return reply.Re[0].Map, nil
	}

	return nil, nil // Tidak ditemukan
}

func CreateOrUpdatePPPoESecret(ip string, port int, routerUser, routerPass, remoteType string, username, password, profile, remoteAddr, localAddr string) error {
	if strings.HasPrefix(remoteType, "REST") {
		protocol := "http"
		if remoteType == "REST-HTTPS" {
			protocol = "https"
		}
		
		// 1. Cek apakah secret sudah ada
		checkUrl := fmt.Sprintf("%s://%s:%d/rest/ppp/secret?name=%s", protocol, ip, port, username)
		body, err := makeRestRequest("GET", checkUrl, routerUser, routerPass, nil, true)
		if err != nil {
			return fmt.Errorf("gagal cek ppp secret via REST: %v", err)
		}
		
		var results []map[string]interface{}
		_ = json.Unmarshal(body, &results)
		
		prof := profile
		if prof == "" {
			prof = "default"
		}
		
		payload := map[string]string{
			"name": username,
			"password": password,
			"profile": prof,
			"service": "pppoe",
		}
		if remoteAddr != "" {
			payload["remote-address"] = remoteAddr
		}
		if localAddr != "" {
			payload["local-address"] = localAddr
		}
		
		if len(results) > 0 {
			// UPDATE
			id := ""
			if val, ok := results[0][".id"].(string); ok {
				id = val
			} else {
				return fmt.Errorf("gagal mendapatkan .id dari ppp secret")
			}
			updateUrl := fmt.Sprintf("%s://%s:%d/rest/ppp/secret/%s", protocol, ip, port, id)
			_, err = makeRestRequest("PATCH", updateUrl, routerUser, routerPass, payload, true)
			if err != nil {
				return fmt.Errorf("gagal update ppp secret via REST: %v", err)
			}
		} else {
			// CREATE
			createUrl := fmt.Sprintf("%s://%s:%d/rest/ppp/secret", protocol, ip, port)
			_, err = makeRestRequest("PUT", createUrl, routerUser, routerPass, payload, true)
			if err != nil {
				return fmt.Errorf("gagal add ppp secret via REST: %v", err)
			}
		}
		return nil
	}

	address := fmt.Sprintf("%s:%d", ip, port)
	var client *routeros.Client
	var err error

	if remoteType == "API-SSL" {
		tlsConfig := &tls.Config{InsecureSkipVerify: true}
		client, err = routeros.DialTLS(address, routerUser, routerPass, tlsConfig)
	} else {
		client, err = routeros.Dial(address, routerUser, routerPass)
	}
	if err != nil {
		return fmt.Errorf("gagal koneksi ke router: %v", err)
	}
	defer client.Close()

	// Cek apakah secret sudah ada
	reply, err := client.Run("/ppp/secret/print", "?name="+username, "=.proplist=.id")
	if err != nil {
		if !strings.Contains(err.Error(), "!empty") {
			return fmt.Errorf("gagal cek ppp secret: %v", err)
		}
	}

	isExists := false
	var id string
	if reply != nil && len(reply.Re) > 0 {
		isExists = true
		id = reply.Re[0].Map[".id"]
	}

	prof := profile
	if prof == "" {
		prof = "default"
	}
	cmdArgs := []string{
		"=name=" + username,
		"=password=" + password,
		"=profile=" + prof,
		"=service=pppoe",
	}

	if remoteAddr != "" {
		cmdArgs = append(cmdArgs, "=remote-address="+remoteAddr)
	}
	if localAddr != "" {
		cmdArgs = append(cmdArgs, "=local-address="+localAddr)
	}

	if isExists {
		// Update
		cmdArgs = append([]string{"/ppp/secret/set", "=.id=" + id}, cmdArgs...)
		replyArgs, errArgs := client.RunArgs(cmdArgs)
		log.Printf("[MIKROTIK DEBUG] UPDATE Secret %s - Reply: %+v, Err: %v, Cmd: %v\n", username, replyArgs, errArgs, cmdArgs)
		if errArgs != nil {
			if !strings.Contains(errArgs.Error(), "!empty") {
				return fmt.Errorf("gagal update ppp secret: %v", errArgs)
			}
		}
	} else {
		// Add
		cmdArgs = append([]string{"/ppp/secret/add"}, cmdArgs...)
		replyArgs, errArgs := client.RunArgs(cmdArgs)
		log.Printf("[MIKROTIK DEBUG] ADD Secret %s - Reply: %+v, Err: %v, Cmd: %v\n", username, replyArgs, errArgs, cmdArgs)
		if errArgs != nil {
			if !strings.Contains(errArgs.Error(), "!empty") {
				return fmt.Errorf("gagal add ppp secret: %v", errArgs)
			}
		}
	}

	return nil
}

func SetPPPoESecretStatus(ip string, port int, routerUser, routerPass, remoteType string, username string, disabled bool) error {
	if strings.HasPrefix(remoteType, "REST") {
		protocol := "http"
		if remoteType == "REST-HTTPS" {
			protocol = "https"
		}
		
		checkUrl := fmt.Sprintf("%s://%s:%d/rest/ppp/secret?name=%s", protocol, ip, port, username)
		body, err := makeRestRequest("GET", checkUrl, routerUser, routerPass, nil, true)
		if err != nil {
			return fmt.Errorf("gagal cek ppp secret via REST: %v", err)
		}
		
		var results []map[string]interface{}
		_ = json.Unmarshal(body, &results)
		if len(results) == 0 {
			return fmt.Errorf("ppp secret tidak ditemukan")
		}
		
		id := ""
		if val, ok := results[0][".id"].(string); ok {
			id = val
		} else {
			return fmt.Errorf("gagal mendapatkan .id dari ppp secret")
		}
		
		action := "false"
		if disabled {
			action = "true"
		}
		
		payload := map[string]string{
			"disabled": action,
		}
		
		updateUrl := fmt.Sprintf("%s://%s:%d/rest/ppp/secret/%s", protocol, ip, port, id)
		_, err = makeRestRequest("PATCH", updateUrl, routerUser, routerPass, payload, true)
		if err != nil {
			return fmt.Errorf("gagal mengubah status ppp secret via REST: %v", err)
		}
		return nil
	}

	address := fmt.Sprintf("%s:%d", ip, port)
	var client *routeros.Client
	var err error

	if remoteType == "API-SSL" {
		tlsConfig := &tls.Config{InsecureSkipVerify: true}
		client, err = routeros.DialTLS(address, routerUser, routerPass, tlsConfig)
	} else {
		client, err = routeros.Dial(address, routerUser, routerPass)
	}
	if err != nil {
		return fmt.Errorf("gagal koneksi ke router: %v", err)
	}
	defer client.Close()

	// Cek apakah secret ada
	reply, err := client.Run("/ppp/secret/print", "?name="+username, "=.proplist=.id")
	if err != nil {
		if strings.Contains(err.Error(), "!empty") {
			return fmt.Errorf("ppp secret tidak ditemukan (kosong)")
		}
		return fmt.Errorf("gagal cek ppp secret: %v", err)
	}
	if reply == nil || len(reply.Re) == 0 {
		return fmt.Errorf("ppp secret tidak ditemukan")
	}

	id := reply.Re[0].Map[".id"]
	
	action := "no"
	if disabled {
		action = "yes"
	}

	_, err = client.RunArgs([]string{
		"/ppp/secret/set",
		"=.id=" + id,
		"=disabled=" + action,
	})
	if err != nil {
		if !strings.Contains(err.Error(), "!empty") {
			return fmt.Errorf("gagal mengubah status ppp secret: %v", err)
		}
	}

	return nil
}
