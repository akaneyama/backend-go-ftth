package controllers

import (
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
	if err := config.DB.First(&router, id).Error; err != nil {
		return utils.Failed(c, "router not found")
	}

	if router.IsDeleted == 1 {
		return utils.Failed(c, "router already deleted")
	}

	router.IsDeleted = 1
	if err := config.DB.Save(&router).Error; err != nil {
		return utils.Error(c, "failed to mark router as deleted")
	}

	return utils.Success(c, "success delete router", nil)
}
