package controllers

import (
	services "akane/be-ftth/Services"
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"

	"github.com/gofiber/fiber/v2"
)

func CreateRouter(c *fiber.Ctx) error {
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

	return utils.Success(c, "success update router data", router)
}

func DeleteRouter(c *fiber.Ctx) error {
	id := c.Params("id")
	var router models.Router
	err := config.DB.Where("router_id = ? AND is_deleted = 0", id).First(&router).Error

	if err != nil {
		return utils.Failed(c, "Router tidak ditemukan atau ID tidak valid")
	}

	if router.IsDeleted == 1 {
		return utils.Failed(c, "Router sudah dihapus sebelumnya")
	}
	router.IsDeleted = 1
	if err := config.DB.Save(&router).Error; err != nil {
		return utils.Error(c, "Gagal menghapus data router")
	}

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
