package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"

	"github.com/gofiber/fiber/v2"
)

func GetLogs(c *fiber.Ctx) error {
	var logs []models.Log

	if err := config.DB.Order("created_at desc").Find(&logs).Error; err != nil {
		return utils.Error(c, "Gagal mengambil data log")
	}

	return utils.Success(c, "Berhasil mengambil data log sistem", logs)
}

func GetLogByID(c *fiber.Ctx) error {
	id := c.Params("id")
	var logData models.Log

	if err := config.DB.First(&logData, "log_id = ?", id).Error; err != nil {
		return utils.Failed(c, "Log tidak ditemukan")
	}

	return utils.Success(c, "Detail log ditemukan", logData)
}
