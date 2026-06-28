package controllers

import (
	services "akane/be-ftth/Services"
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// kalau gabisa tambah pppoe bisa pakai restapi
func CreateRouter(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)
	var router models.Router
	if err := c.BodyParser(&router); err != nil {
		return utils.Failed(c, "Invalid request body")
	}

	if router.RouterName == "" || router.RouterAddress == "" || router.RouterPort == 0 || router.RouterStatus == "" ||
		router.RouterType == "" || router.RouterRemoteType == "" || router.RouterUsername == "" || router.RouterPassword == "" {
		return utils.Failed(c, "all field must be filled!")
	}

	if router.RouterPort <= 0 {
		return utils.Failed(c, "Router Port Must be greater than 0!")
	}

	passwordEnkripsi, _ := utils.EncryptAES(router.RouterPassword)
	router.RouterPassword = string(passwordEnkripsi)

	if err := config.DB.Create(&router).Error; err != nil {
		return utils.Error(c, "Failed to insert data!")
	}

	logDesc := fmt.Sprintf("Create Router baru: %s (Address: %s) (Tipe: %s)", router.RouterName, router.RouterAddress, router.RouterType)
	utils.CreateLog(adminPelaku, "ROUTER", "TAMBAH ROUTER", logDesc)
	return utils.Success(c, "Success insert data", nil)
}

func GetRouters(c *fiber.Ctx) error {
	var router []models.Router
	config.DB.Where("is_deleted = ?", 0).Find(&router)
	for i := range router {
		router[i].RouterPassword = "Password Encypted!"
	}
	return utils.Success(c, "Success retrieve data", router)
}

func GetRouter(c *fiber.Ctx) error {
	id := c.Params("id")
	var router models.Router
	result := config.DB.Where("router_id = ? AND is_deleted = ?", id, 0).First(&router)
	if result.Error != nil {
		return utils.Failed(c, "router not found or deleted")
	}
	router.RouterPassword = "Password Encrypted!"
	return utils.Success(c, "success retrieve data", router)
}

func UpdateRouter(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)
	id := c.Params("id")

	var router models.Router
	if err := config.DB.Where("router_id = ? AND is_deleted = 0", id).First(&router).Error; err != nil {
		return utils.Failed(c, "router not found or already deleted")
	}

	var payload models.Router
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	if payload.RouterName == "" ||
		payload.RouterAddress == "" ||
		payload.RouterPort <= 0 ||
		payload.RouterStatus == "" ||
		payload.RouterType == "" ||
		payload.RouterRemoteType == "" ||
		payload.RouterUsername == "" {
		return utils.Failed(c, "all fields except password must be filled")
	}

	router.RouterName = payload.RouterName
	router.RouterAddress = payload.RouterAddress
	router.RouterPort = payload.RouterPort
	router.RouterRestPort = payload.RouterRestPort
	router.RouterStatus = payload.RouterStatus
	router.RouterType = payload.RouterType
	router.RouterRemoteType = payload.RouterRemoteType
	router.RouterUsername = payload.RouterUsername

	if payload.RouterPassword != "" {
		enc, err := utils.EncryptAES(payload.RouterPassword)
		if err != nil {
			return utils.Failed(c, "failed to encrypt password")
		}
		router.RouterPassword = enc
	}

	if err := config.DB.Save(&router).Error; err != nil {
		return utils.Failed(c, "failed to update router")
	}

	router.RouterPassword = ""
	logDesc := fmt.Sprintf("Update Router %s %s %s %d %s ke %s %s %s %d %s",
		router.RouterName, router.RouterAddress, router.RouterType, router.RouterPort, router.RouterStatus, payload.RouterName, payload.RouterAddress, payload.RouterType, payload.RouterPort, payload.RouterStatus)
	utils.CreateLog(adminPelaku, "ROUTER", "UPDATE ROUTER", logDesc)
	return utils.Success(c, "success update router data", router)
}

func DeleteRouter(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)
	id := c.Params("id")
	var router models.Router
	var interfacemonitoring []models.InterfaceMonitoring
	err := config.DB.Where("router_id = ? AND is_deleted = 0", id).First(&router).Error
	monitoringerr := config.DB.Where("router_id = ? AND is_deleted = 0", id).Find(&interfacemonitoring).Error

	if err != nil {
		return utils.Failed(c, "Router tidak ditemukan atau ID tidak valid")
	}
	if monitoringerr != nil {
		return utils.Failed(c, "Interface tidak ditemukan atau ID tidak valid")
	}

	if router.IsDeleted == 1 {
		return utils.Failed(c, "Router sudah dihapus sebelumnya")
	}
	router.IsDeleted = 1
	for i := range interfacemonitoring {
		interfacemonitoring[i].IsDeleted = 1
	}
	if err := config.DB.Save(&router).Error; err != nil {
		return utils.Error(c, "Gagal menghapus data router")
	}
	if err := config.DB.Save(&interfacemonitoring).Error; err != nil {
		return utils.Error(c, "Gagal menghapus data interface")
	}
	logDesc := fmt.Sprintf("Delete Router %s %s %s %d %s",
		router.RouterName, router.RouterAddress, router.RouterType, router.RouterPort, router.RouterStatus)
	utils.CreateLog(adminPelaku, "ROUTER", "DELETE ROUTER", logDesc)
	return utils.Success(c, "Sukses menghapus router", nil)
}

func CheckRouterConnection(c *fiber.Ctx) error {
	id := c.Params("id")
	var router models.Router

	if err := config.DB.Where("router_id = ? AND is_deleted = 0", id).First(&router).Error; err != nil {
		return utils.Failed(c, "Router tidak ditemukan")
	}
	decryptedPass, err := utils.DecryptAES(router.RouterPassword)
	if err != nil {
		return utils.Failed(c, "Gagal mendekripsi password router")
	}

	info, err := services.GetRouterSystemInfo(
		router.RouterAddress,
		router.RouterPort,
		router.RouterUsername,
		decryptedPass,
		router.RouterRemoteType,
	)

	if err != nil {
		return utils.Failed(c, err.Error())
	}

	return utils.Success(c, "Koneksi Berhasil & Data Ditemukan", fiber.Map{
		"router_name": router.RouterName,
		"router_ip":   router.RouterAddress,
		"system_info": info,
	})
}
func TestRouterConnection(c *fiber.Ctx) error {
	var payload models.Router
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "Invalid request body")
	}

	if payload.RouterAddress == "" || payload.RouterUsername == "" || payload.RouterPassword == "" {
		return utils.Failed(c, "IP, Username, dan Password harus diisi untuk tes koneksi")
	}

	if payload.RouterPort == 0 {
		payload.RouterPort = 8728
	}

	info, err := services.GetRouterSystemInfo(
		payload.RouterAddress,
		payload.RouterPort,
		payload.RouterUsername,
		payload.RouterPassword,
		payload.RouterRemoteType,
	)

	if err != nil {
		return utils.Failed(c, "Koneksi Gagal: "+err.Error())
	}

	return utils.Success(c, "Koneksi Berhasil", fiber.Map{
		"system_info": info,
	})
}

func GetRouterPPPProfiles(c *fiber.Ctx) error {
	id := c.Params("id")
	var router models.Router

	if err := config.DB.Where("router_id = ? AND is_deleted = 0", id).First(&router).Error; err != nil {
		return utils.Failed(c, "Router tidak ditemukan")
	}
	decryptedPass, err := utils.DecryptAES(router.RouterPassword)
	if err != nil {
		return utils.Failed(c, "Gagal mendekripsi password router")
	}

	profiles, err := services.GetPPPoEProfiles(
		router.RouterAddress,
		router.RouterPort,
		router.RouterUsername,
		decryptedPass,
		router.RouterRemoteType,
	)

	if err != nil {
		return utils.Failed(c, "Gagal mengambil profile: "+err.Error())
	}

	return utils.Success(c, "Berhasil mengambil PPP Profiles", profiles)
}

func TestPPPoEConnection(c *fiber.Ctx) error {
	type CheckPayload struct {
		RouterID      string `json:"router_id"`
		PppoeUsername string `json:"pppoe_username"`
		PppoePassword string `json:"pppoe_password"`
		PppoeProfile  string `json:"pppoe_profile"`
		IPAddress     string `json:"ip_address"`
	}

	var payload CheckPayload
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "Invalid request body")
	}

	if payload.RouterID == "" || payload.PppoeUsername == "" || payload.PppoePassword == "" {
		return utils.Failed(c, "Router, Username, dan Password PPPoE harus diisi")
	}

	var router models.Router
	if err := config.DB.Where("router_id = ? AND is_deleted = 0", payload.RouterID).First(&router).Error; err != nil {
		return utils.Failed(c, "Router tidak ditemukan")
	}

	decryptedPass, err := utils.DecryptAES(router.RouterPassword)
	if err != nil {
		return utils.Failed(c, "Gagal mendekripsi password router")
	}

	localAddr := "" // Kosongkan saja untuk tes
	prof := payload.PppoeProfile
	if prof == "" {
		prof = "default"
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
		payload.PppoeUsername,
		payload.PppoePassword,
		prof,
		payload.IPAddress,
		localAddr,
	)

	if errMikrotik != nil {
		return utils.Failed(c, "Gagal mengeksekusi PPPoE ke Mikrotik: "+errMikrotik.Error())
	}

	return utils.Success(c, "Berhasil! Data PPPoE tersimpan di Mikrotik.", nil)
}

func CheckPPPoEExists(c *fiber.Ctx) error {
	type CheckPayload struct {
		RouterID      string `json:"router_id"`
		PppoeUsername string `json:"pppoe_username"`
	}

	var payload CheckPayload
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "Invalid request body")
	}

	if payload.RouterID == "" || payload.PppoeUsername == "" {
		return utils.Failed(c, "Router dan Username PPPoE harus diisi")
	}

	var router models.Router
	if err := config.DB.Where("router_id = ? AND is_deleted = 0", payload.RouterID).First(&router).Error; err != nil {
		return utils.Failed(c, "Router tidak ditemukan")
	}

	decryptedPass, err := utils.DecryptAES(router.RouterPassword)
	if err != nil {
		return utils.Failed(c, "Gagal mendekripsi password router")
	}

	port := router.RouterPort
	if strings.HasPrefix(router.RouterRemoteType, "REST") {
		port = router.RouterRestPort
	}

	data, errMikrotik := services.CheckPPPoESecret(
		router.RouterAddress,
		port,
		router.RouterUsername,
		decryptedPass,
		router.RouterRemoteType,
		payload.PppoeUsername,
	)

	if errMikrotik != nil {
		return utils.Failed(c, "Gagal mengecek PPPoE di Mikrotik: "+errMikrotik.Error())
	}

	if data == nil {
		return utils.Success(c, "Data PPPoE BELUM ADA di Mikrotik.", fiber.Map{
			"exists": false,
		})
	}

	return utils.Success(c, "Data PPPoE SUDAH ADA di Mikrotik.", fiber.Map{
		"exists": true,
		"data":   data,
	})
}
