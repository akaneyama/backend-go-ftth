package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func CreatePackage(c *fiber.Ctx) error {
	var internetpackage models.Internetpackage
	if err := c.BodyParser(&internetpackage); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	if internetpackage.PackageName == "" || internetpackage.PackageLimit == "" ||
		internetpackage.PackagePrice == 0 || internetpackage.PackageDesc == "" {
		return utils.Failed(c, "all field must be filled!")
	}

	angkacek := strings.Split(internetpackage.PackageLimit, "/")
	if len(angkacek) != 2 {
		return utils.Failed(c, "invalid limit!")
	}

	println(angkacek)
	if internetpackage.PackagePrice <= 0 {
		return utils.Failed(c, "package Must be greater than 0!")
	}

	if err := config.DB.Create(&internetpackage).Error; err != nil {
		return utils.Error(c, "Failed to insert data!")
	}
	return utils.Success(c, "Success insert data", nil)
}

func GetInternetPackages(c *fiber.Ctx) error {
	var internetpackage models.Internetpackage
	config.DB.Where("is_deleted = ?", 0).Find(&internetpackage)
	return utils.Success(c, "Success retrieve data", internetpackage)
}

func GetInternetPackage(c *fiber.Ctx) error {
	id := c.Params("id")
	var internetpackage models.Internetpackage
	result := config.DB.Where("package_id = ? AND is_deleted = ?", id, 0).First(&internetpackage)
	if result.Error != nil {
		return utils.Failed(c, "package not found or deleted")
	}
	return utils.Success(c, "success retrieve data", internetpackage)
}

func UpdateInternetPackage(c *fiber.Ctx) error {
	id := c.Params("id")
	var internetpackage models.Internetpackage
	if err := config.DB.Where("package_id = ? AND is_deleted = 0", id).First(&internetpackage).Error; err != nil {
		return utils.Failed(c, "package not found or already deleted")
	}

	var payload models.Internetpackage
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	if payload.PackageName == "" || payload.PackageLimit == "" || payload.PackagePrice <= 0 || payload.PackageDesc == "" {
		return utils.Failed(c, "all fields except password must be filled")
	}

	internetpackage.PackageName = payload.PackageName
	internetpackage.PackageLimit = payload.PackageLimit
	internetpackage.PackageDesc = payload.PackageDesc
	internetpackage.PackagePrice = payload.PackagePrice

	if err := config.DB.Save(&internetpackage).Error; err != nil {
		return utils.Failed(c, "failed to update package")
	}

	return utils.Success(c, "success update package data", internetpackage)
}

func DeletePackage(c *fiber.Ctx) error {
	id := c.Params("id")
	var internetpackage models.Internetpackage
	if err := config.DB.First(&internetpackage, id).Error; err != nil {
		return utils.Failed(c, "package not found")
	}

	if internetpackage.IsDeleted == 1 {
		return utils.Failed(c, "package already deleted")
	}

	internetpackage.IsDeleted = 1
	if err := config.DB.Save(&internetpackage).Error; err != nil {
		return utils.Error(c, "failed to mark package as deleted")
	}

	return utils.Success(c, "success delete package", nil)
}
