package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// CreatePackage membuat paket internet baru
func CreatePackage(c *fiber.Ctx) error {
	// 1. Ambil Admin Pelaku
	adminPelaku := utils.GetUserFromContext(c)

	var internetpackage models.Internetpackage
	if err := c.BodyParser(&internetpackage); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	// Validasi field kosong
	if internetpackage.PackageName == "" || internetpackage.PackageLimit == "" ||
		internetpackage.PackagePrice == 0 || internetpackage.PackageDesc == "" {
		return utils.Failed(c, "all field must be filled!")
	}

	// Validasi format limit (misal: "10M/10M")
	angkacek := strings.Split(internetpackage.PackageLimit, "/")
	if len(angkacek) != 2 {
		return utils.Failed(c, "invalid limit format (contoh: 20M/20M)")
	}

	if internetpackage.PackagePrice <= 0 {
		return utils.Failed(c, "package price must be greater than 0!")
	}

	// Simpan ke database
	if err := config.DB.Create(&internetpackage).Error; err != nil {
		return utils.Error(c, "Failed to insert data!")
	}

	// --- LOGGING ---
	logDesc := fmt.Sprintf("Tambah Paket Internet Baru: %s (Limit: %s, Harga: Rp %d)",
		internetpackage.PackageName, internetpackage.PackageLimit, internetpackage.PackagePrice)
	utils.CreateLog(adminPelaku, "PACKAGE", "CREATE", logDesc)
	// ---------------

	return utils.Success(c, "Success insert data", nil)
}

// GetInternetPackages mengambil semua paket (Slice)
func GetInternetPackages(c *fiber.Ctx) error {
	var internetpackages []models.Internetpackage // Perbaikan: Gunakan Slice [] untuk menampung banyak data

	if err := config.DB.Where("is_deleted = ?", 0).Find(&internetpackages).Error; err != nil {
		return utils.Error(c, "Failed to retrieve packages")
	}

	return utils.Success(c, "Success retrieve data", internetpackages)
}

// GetInternetPackage mengambil satu paket detail
func GetInternetPackage(c *fiber.Ctx) error {
	id := c.Params("id")
	var internetpackage models.Internetpackage

	result := config.DB.Where("package_id = ? AND is_deleted = ?", id, 0).First(&internetpackage)
	if result.Error != nil {
		return utils.Failed(c, "package not found or deleted")
	}

	return utils.Success(c, "success retrieve data", internetpackage)
}

// UpdateInternetPackage update data paket
func UpdateInternetPackage(c *fiber.Ctx) error {
	// 1. Ambil Admin Pelaku
	adminPelaku := utils.GetUserFromContext(c)
	id := c.Params("id")

	var internetpackage models.Internetpackage
	// Cari data lama dulu
	if err := config.DB.Where("package_id = ? AND is_deleted = 0", id).First(&internetpackage).Error; err != nil {
		return utils.Failed(c, "package not found or already deleted")
	}

	// Simpan nama lama untuk log
	oldName := internetpackage.PackageName
	oldPrice := internetpackage.PackagePrice

	var payload models.Internetpackage
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	if payload.PackageName == "" || payload.PackageLimit == "" || payload.PackagePrice <= 0 || payload.PackageDesc == "" {
		return utils.Failed(c, "all fields must be filled and valid")
	}

	// Update field
	internetpackage.PackageName = payload.PackageName
	internetpackage.PackageLimit = payload.PackageLimit
	internetpackage.PackageDesc = payload.PackageDesc
	internetpackage.PackagePrice = payload.PackagePrice

	if err := config.DB.Save(&internetpackage).Error; err != nil {
		return utils.Failed(c, "failed to update package")
	}

	// --- LOGGING ---
	logDesc := fmt.Sprintf("Update Paket ID %s. Dari [%s - Rp %d] Menjadi [%s - Rp %d]",
		id, oldName, oldPrice, payload.PackageName, payload.PackagePrice)
	utils.CreateLog(adminPelaku, "PACKAGE", "UPDATE", logDesc)
	// ---------------

	return utils.Success(c, "success update package data", internetpackage)
}

// DeletePackage soft delete paket
func DeletePackage(c *fiber.Ctx) error {
	// 1. Ambil Admin Pelaku
	adminPelaku := utils.GetUserFromContext(c)
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

	// --- LOGGING ---
	logDesc := fmt.Sprintf("Hapus Paket Internet: %s (ID: %s)", internetpackage.PackageName, id)
	utils.CreateLog(adminPelaku, "PACKAGE", "DELETE", logDesc)
	// ---------------

	return utils.Success(c, "success delete package", nil)
}
