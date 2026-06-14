package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type Device struct {
	ID                string                `json:"_id"`
	LastInform        string                `json:"_lastInform"`
	VirtualParameters VirtualParameters     `json:"VirtualParameters"`
	InternetGateway   InternetGatewayDevice `json:"InternetGatewayDevice"`
	DeviceID          DeviceID              `json:"_deviceId"`
}

type DeviceID struct {
	ProductClass string `json:"_ProductClass"`
	Manufacturer string `json:"_Manufacturer"`
	SerialNumber string `json:"_SerialNumber"`
}

type InternetGatewayDevice struct {
	LANDevice LANDevice `json:"LANDevice"`
	WANDevice WANDevice `json:"WANDevice"`
}

type LANDevice struct {
	Device1 LANDevice1 `json:"1"`
}

type LANDevice1 struct {
	WLANConfiguration WLANConfiguration `json:"WLANConfiguration"`
}

type WLANConfiguration struct {
	Config1 WLANConfig1 `json:"1"`
}

type WLANConfig1 struct {
	SSID SSID `json:"SSID"`
}

type SSID struct {
	Value string `json:"_value"`
}

type WANDevice struct {
	Device1 WANDevice1 `json:"1"`
}

type WANDevice1 struct {
	WANConnectionDevice WANConnectionDevice `json:"WANConnectionDevice"`
}

type WANConnectionDevice struct {
	Device1 WANConnection1 `json:"1"`
}

type WANConnection1 struct {
	WANIPConnection  WANIPConnection `json:"WANIPConnection"` //WANPPPConnection
	WANPPPConnection WANIPConnection `json:"WANPPPConnection"`
}

type WANIPConnection struct {
	Device1 WANIPConnection1 `json:"1"`
}

type WANIPConnection1 struct {
	ExternalIPAddress Parameter `json:"ExternalIPAddress"`
	MACAddress        Parameter `json:"MACAddress"`
	DNSServers        Parameter `json:"DNSServers"`
}

type VirtualParameters struct {
	IPTR069      Parameter `json:"IPTR069"`
	RxPower      Parameter `json:"RXPower"`
	DeviceSN     Parameter `json:"getSerialNumber"`
	Temp         Parameter `json:"gettemp"`
	Pon          Parameter `json:"getponmode"`
	DeviceUptime Parameter `json:"getdeviceuptime"`
	PonMac       Parameter `json:"PonMac"`
	PppoeIP      Parameter `json:"pppoeIP"`
	PppoeMac     Parameter `json:"pppoeMac"`
	PppoeUser    Parameter `json:"pppoeUsername"`
}

type Parameter struct {
	Value string `json:"_value"`
}

func GetDeviceIDByIP(urlAcs, ip string) (string, string, string, string, string, string, string, string, string, string, string, error) {
	parameters := strings.Join([]string{
		"_id",
		"_lastInform",
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID._value",
		"VirtualParameters.IPTR069._value",
		"VirtualParameters.pppoeIP._value",
		"VirtualParameters.RXPower._value",
		"_deviceId._SerialNumber",
		"VirtualParameters.gettemp._value",
		"VirtualParameters.getponmode._value",
		"VirtualParameters.PonMac._value",
		"VirtualParameters.pppoeMac._value",
		"_deviceId._Manufacturer",
		"_deviceId._ProductClass",
		"VirtualParameters.getdeviceuptime._value",
	}, ",")
	// query search in IPTR069, pppoeIP, and SerialNumber to find the device
	url := urlAcs + "/devices?projection=" + parameters + "&query={\"$or\":[{\"_deviceId._SerialNumber\":\"" + ip + "\"},{\"VirtualParameters.IPTR069._value\":\"" + ip + "\"},{\"VirtualParameters.pppoeIP._value\":\"" + ip + "\"},{\"InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress._value\":\"" + ip + "\"},{\"InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress._value\":\"" + ip + "\"}]}"

	resp, err := http.Get(url)
	if err != nil {
		return "", "", "", "", "", "", "", "", "", "", "", err
	}

	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var devices []Device

	err = json.Unmarshal(body, &devices)
	if err != nil {
		return "", "", "", "", "", "", "", "", "", "", "", err
	}

	if len(devices) == 0 {
		return "", "", "", "", "", "", "", "", "", "", "", fmt.Errorf("device not found")
	}
	d := devices[0]
	id := d.ID
	LastInform := d.LastInform
	Ssid := d.InternetGateway.LANDevice.Device1.WLANConfiguration.Config1.SSID.Value
	if Ssid == "" {
		Ssid = "Unknown/Hidden"
	}

	// Pick IPAddress from Virtual Parameters (Stabilized)
	IPAddress := d.VirtualParameters.IPTR069.Value
	if IPAddress == "" || IPAddress == "0.0.0.0" {
		IPAddress = d.VirtualParameters.PppoeIP.Value
	}

	RXPower := d.VirtualParameters.RxPower.Value
	DeviceSN := d.DeviceID.SerialNumber
	if DeviceSN == "" {
		DeviceSN = d.VirtualParameters.DeviceSN.Value
	}

	Temp := d.VirtualParameters.Temp.Value
	PonMode := d.VirtualParameters.Pon.Value
	Manufaktur := d.DeviceID.Manufacturer + "-" + d.DeviceID.ProductClass

	// Pick MACAddress from Virtual Parameters (Stabilized)
	MACAddress := d.VirtualParameters.PonMac.Value
	if MACAddress == "" {
		MACAddress = d.VirtualParameters.PppoeMac.Value
	}

	UPtime := d.VirtualParameters.DeviceUptime.Value

	return id, LastInform, Ssid, IPAddress, RXPower, DeviceSN, Temp, PonMode, MACAddress, Manufaktur, UPtime, nil
}

// UpdateWifiConfig sends a task to GenieACS to update the WiFi SSID and Password
func UpdateWifiConfig(urlAcs, deviceID, newSsid, newPassword string, ssidIndex int) error {
	if ssidIndex == 0 {
		ssidIndex = 1
	}

	var parameterValues [][]interface{}

	// Hanya tambahkan jika parameter tidak kosong
	if newSsid != "" {
		parameterValues = append(parameterValues, []interface{}{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.SSID", ssidIndex), newSsid, "xsd:string",
		})
	}

	if newPassword != "" {
		parameterValues = append(parameterValues, []interface{}{
			"VirtualParameters.WlanPassword", newPassword, "xsd:string",
		})
	}

	if len(parameterValues) == 0 {
		return fmt.Errorf("SSID or Password must be provided")
	}

	task := map[string]interface{}{
		"name":            "setParameterValues",
		"parameterValues": parameterValues,
	}

	taskJSON, err := json.Marshal(task)
	if err != nil {
		return fmt.Errorf("failed to marshal task: %v", err)
	}

	// Build URL with connection_request to push the task immediately
	url := fmt.Sprintf("%s/devices/%s/tasks?connection_request", urlAcs, deviceID)

	resp, err := http.Post(url, "application/json", strings.NewReader(string(taskJSON)))
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

type DeviceInfoResponse struct {
	DeviceID   string `json:"deviceId"`
	LastInform string `json:"lastInform"`
	SSID       string `json:"ssid"`
	IPAddress  string `json:"ipAddress"`
	RXPower    string `json:"rxPower"`
	DeviceSN   string `json:"deviceSN"`
	Temp       string `json:"temp"`
	PonMode    string `json:"ponMode"`
	MACAddress string `json:"macAddress"`
	Manufaktur string `json:"manufaktur"`
	Uptime     string `json:"uptime"`
}

func GetAllDevices(urlAcs string) ([]DeviceInfoResponse, error) {
	parameters := strings.Join([]string{
		"_id",
		"_lastInform",
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID._value",
		"VirtualParameters.IPTR069._value",
		"VirtualParameters.pppoeIP._value",
		"VirtualParameters.RXPower._value",
		"_deviceId._SerialNumber",
		"VirtualParameters.gettemp._value",
		"VirtualParameters.getponmode._value",
		"VirtualParameters.PonMac._value",
		"VirtualParameters.pppoeMac._value",
		"_deviceId._Manufacturer",
		"_deviceId._ProductClass",
		"VirtualParameters.getdeviceuptime._value",
	}, ",")
	url := urlAcs + "/devices?projection=" + parameters

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var devices []Device
	err = json.Unmarshal(body, &devices)
	if err != nil {
		return nil, err
	}

	var results []DeviceInfoResponse
	for _, d := range devices {
		Ssid := d.InternetGateway.LANDevice.Device1.WLANConfiguration.Config1.SSID.Value
		if Ssid == "" {
			Ssid = "Unknown/Hidden"
		}
		IPAddress := d.VirtualParameters.IPTR069.Value
		if IPAddress == "" || IPAddress == "0.0.0.0" {
			IPAddress = d.VirtualParameters.PppoeIP.Value
		}
		RXPower := d.VirtualParameters.RxPower.Value
		DeviceSN := d.DeviceID.SerialNumber
		if DeviceSN == "" {
			DeviceSN = d.VirtualParameters.DeviceSN.Value
		}
		Temp := d.VirtualParameters.Temp.Value
		PonMode := d.VirtualParameters.Pon.Value
		Manufaktur := d.DeviceID.Manufacturer + "-" + d.DeviceID.ProductClass
		MACAddress := d.VirtualParameters.PonMac.Value
		if MACAddress == "" {
			MACAddress = d.VirtualParameters.PppoeMac.Value
		}
		UPtime := d.VirtualParameters.DeviceUptime.Value

		results = append(results, DeviceInfoResponse{
			DeviceID:   d.ID,
			LastInform: d.LastInform,
			SSID:       Ssid,
			IPAddress:  IPAddress,
			RXPower:    RXPower,
			DeviceSN:   DeviceSN,
			Temp:       Temp,
			PonMode:    PonMode,
			MACAddress: MACAddress,
			Manufaktur: Manufaktur,
			Uptime:     UPtime,
		})
	}
	return results, nil
}

type HostDevice struct {
	MACAddress      string `json:"macAddress"`
	IPAddress       string `json:"ipAddress"`
	HostName        string `json:"hostName"`
	Active          string `json:"active"`
	Layer1Interface string `json:"layer1Interface"`
}

func GetConnectedHosts(urlAcs, deviceID string) ([]HostDevice, error) {
	url := urlAcs + "/devices/?query={\"_id\":\"" + deviceID + "\"}&projection=InternetGatewayDevice.LANDevice.1.Hosts.Host"
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var rawData []map[string]interface{}
	err = json.Unmarshal(body, &rawData)
	if err != nil {
		return nil, err
	}

	if len(rawData) == 0 {
		return nil, fmt.Errorf("device not found")
	}

	var hosts []HostDevice
	igd, ok := rawData[0]["InternetGatewayDevice"].(map[string]interface{})
	if !ok { return hosts, nil }
	lan, ok := igd["LANDevice"].(map[string]interface{})
	if !ok { return hosts, nil }
	lan1, ok := lan["1"].(map[string]interface{})
	if !ok { return hosts, nil }
	hostsNode, ok := lan1["Hosts"].(map[string]interface{})
	if !ok { return hosts, nil }
	hostMap, ok := hostsNode["Host"].(map[string]interface{})
	if !ok { return hosts, nil }

	for _, hostRaw := range hostMap {
		host, ok := hostRaw.(map[string]interface{})
		if !ok { continue }

		h := HostDevice{}
		if macObj, ok := host["MACAddress"].(map[string]interface{}); ok {
			if v, ok := macObj["_value"].(string); ok { h.MACAddress = v }
		}
		if ipObj, ok := host["IPAddress"].(map[string]interface{}); ok {
			if v, ok := ipObj["_value"].(string); ok { h.IPAddress = v }
		}
		if nameObj, ok := host["HostName"].(map[string]interface{}); ok {
			if v, ok := nameObj["_value"].(string); ok { h.HostName = v }
		}
		if actObj, ok := host["Active"].(map[string]interface{}); ok {
			if v, ok := actObj["_value"]; ok { 
                h.Active = fmt.Sprintf("%v", v)
            }
		}
		if l1Obj, ok := host["Layer1Interface"].(map[string]interface{}); ok {
			if v, ok := l1Obj["_value"].(string); ok { h.Layer1Interface = v }
		}
        
        if h.MACAddress != "" {
		    hosts = append(hosts, h)
        }
	}
	return hosts, nil
}
