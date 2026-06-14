package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

func GetDeviceACSInfo(c *fiber.Ctx) error {
	ip := c.Query("ip")
	if ip == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "IP address is required"})
	}

	urlAcs := os.Getenv("GENIE_ACS_URL")
	if urlAcs == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "GENIE_ACS_URL is not configured in .env"})
	}

	id, LastInform, Ssid, IPAddress, RXPower, DeviceSN, Temp, PonMode, MACAddress, Manufaktur, UPtime, err := utils.GetDeviceIDByIP(urlAcs, ip)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"deviceId":    id,
		"lastInform":  LastInform,
		"ssid":        Ssid,
		"ipAddress":   IPAddress,
		"rxPower":     RXPower,
		"deviceSN":    DeviceSN,
		"temp":        Temp,
		"ponMode":     PonMode,
		"macAddress":  MACAddress,
		"manufaktur":  Manufaktur,
		"uptime":      UPtime,
	})
}

func UpdateDeviceACSWifi(c *fiber.Ctx) error {
	type RequestBody struct {
		DeviceID    string `json:"deviceId"`
		NewSsid     string `json:"newSsid"`
		NewPassword string `json:"newPassword"`
		SsidIndex   int    `json:"ssidIndex"`
	}

	var body RequestBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	if body.DeviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "deviceId is required"})
	}

	urlAcs := os.Getenv("GENIE_ACS_URL")
	if urlAcs == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "GENIE_ACS_URL is not configured in .env"})
	}

	err := utils.UpdateWifiConfig(urlAcs, body.DeviceID, body.NewSsid, body.NewPassword, body.SsidIndex)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "WiFi configuration task sent successfully"})
}

func GetAllDevicesACS(c *fiber.Ctx) error {
	urlAcs := os.Getenv("GENIE_ACS_URL")
	if urlAcs == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "GENIE_ACS_URL is not configured in .env"})
	}

	devices, err := utils.GetAllDevices(urlAcs)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   devices,
	})
}

func GetDeviceHostsACS(c *fiber.Ctx) error {
	deviceID := c.Query("deviceId")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "deviceId is required"})
	}

	urlAcs := os.Getenv("GENIE_ACS_URL")
	if urlAcs == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "GENIE_ACS_URL is not configured in .env"})
	}

	hosts, err := utils.GetConnectedHosts(urlAcs, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   hosts,
	})
}

func GetDeviceRxHistory(c *fiber.Ctx) error {
	deviceSN := c.Query("deviceSn")
	if deviceSN == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "deviceSn is required"})
	}

	var history []models.RxPowerHistory
	// Get the last 7 days of history, ordered by time ascending
	err := config.DB.Where("device_sn = ? AND recorded_at >= ?", deviceSN, time.Now().AddDate(0, 0, -7)).
		Order("recorded_at ASC").
		Find(&history).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get history"})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   history,
	})
}
