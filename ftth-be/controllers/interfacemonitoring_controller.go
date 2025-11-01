package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func CreateInterfaceMonitoring(c *fiber.Ctx) error {
	var iface models.InterfaceMonitoring
	if err := c.BodyParser(&iface); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	if iface.InterfaceName == "" || iface.RouterID == uuid.Nil {
		return utils.Failed(c, "interface_name and router_id are required")
	}

	var router models.Router
	if err := config.DB.First(&router, "router_id = ?", iface.RouterID).Error; err != nil {
		return utils.Failed(c, "router_id not found")
	}

	if err := config.DB.Create(&iface).Error; err != nil {
		return utils.Error(c, "failed to insert interface data")
	}

	return utils.Success(c, "success insert interface data", nil)
}

// GetInterfacesMonitoring mengambil semua data interface yang tidak terhapus
func GetInterfacesMonitoring(c *fiber.Ctx) error {
	var interfaces []models.InterfaceMonitoring

	// Mengambil data dengan IsDeleted = 0
	// Anda juga bisa menambahkan .Preload("Router") jika ingin data router ikut terambil
	config.DB.Where("is_deleted = ?", 0).Find(&interfaces)

	return utils.Success(c, "success retrieve interface data", interfaces)
}

// GetInterfaceMonitoring mengambil satu data interface berdasarkan ID
func GetInterfaceMonitoring(c *fiber.Ctx) error {
	id := c.Params("id") // ID ini adalah interface_id
	var iface models.InterfaceMonitoring

	// Mencari berdasarkan primary key (interface_id) dan status IsDeleted
	result := config.DB.Where("interface_id = ? AND is_deleted = ?", id, 0).First(&iface)
	if result.Error != nil {
		return utils.Failed(c, "interface not found or deleted")
	}

	return utils.Success(c, "success retrieve interface data", iface)
}

// UpdateInterfaceMonitoring memperbarui data interface yang ada
func UpdateInterfaceMonitoring(c *fiber.Ctx) error {
	id := c.Params("id")
	var iface models.InterfaceMonitoring

	// 1. Cari dulu data yang ada
	if err := config.DB.Where("interface_id = ? AND is_deleted = ?", id, 0).First(&iface).Error; err != nil {
		return utils.Failed(c, "interface not found or deleted")
	}

	// 2. Parse payload baru
	var payload models.InterfaceMonitoring
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	// 3. Timpa field yang diizinkan untuk diubah
	// (Sama seperti user_controller, kita asumsikan payload berisi data yang valid)
	iface.InterfaceName = payload.InterfaceName
	iface.RouterID = payload.RouterID

	// 4. Simpan perubahan
	if err := config.DB.Save(&iface).Error; err != nil {
		return utils.Error(c, "failed to update interface data")
	}

	return utils.Success(c, "success update interface data", nil)
}

// DeleteInterfaceMonitoring melakukan soft delete pada interface
func DeleteInterfaceMonitoring(c *fiber.Ctx) error {
	id := c.Params("id")

	var iface models.InterfaceMonitoring
	// 1. Cari data, bahkan jika sudah terhapus (untuk pengecekan)
	if err := config.DB.First(&iface, "interface_id = ?", id).Error; err != nil {
		return utils.Failed(c, "interface not found")
	}

	// 2. Cek apakah sudah di-soft-delete sebelumnya
	if iface.IsDeleted == 1 {
		return utils.Failed(c, "interface already deleted")
	}

	// 3. Set flag IsDeleted
	iface.IsDeleted = 1
	if err := config.DB.Save(&iface).Error; err != nil {
		return utils.Error(c, "failed to mark interface as deleted")
	}

	return utils.Success(c, "success soft delete interface", nil)
}
