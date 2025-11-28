package controllers

import (
	services "akane/be-ftth/Services"
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// CreateInterfaceMonitoring menambah data monitoring baru
func CreateInterfaceMonitoring(c *fiber.Ctx) error {
	// 1. Ambil Admin Pelaku
	adminPelaku := utils.GetUserFromContext(c)

	var iface models.InterfaceMonitoring
	if err := c.BodyParser(&iface); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	if iface.InterfaceName == "" || iface.RouterID == uuid.Nil {
		return utils.Failed(c, "interface_name and router_id are required")
	}

	// Cek Router Induk
	var router models.Router
	if err := config.DB.First(&router, "router_id = ?", iface.RouterID).Error; err != nil {
		return utils.Failed(c, "router_id not found")
	}

	// Cek Duplikasi
	var checkDuplicate models.InterfaceMonitoring
	if err := config.DB.Where("router_id = ? AND interface_name = ? AND is_deleted = 0", iface.RouterID, iface.InterfaceName).First(&checkDuplicate).Error; err == nil {
		return utils.Failed(c, "Interface ini sudah dimonitoring pada router tersebut!")
	}

	if err := config.DB.Create(&iface).Error; err != nil {
		return utils.Error(c, "failed to insert interface data")
	}

	// --- LOGGING ---
	logDesc := fmt.Sprintf("Tambah Monitoring Interface: %s pada Router %s (%s)", iface.InterfaceName, router.RouterName, router.RouterAddress)
	utils.CreateLog(adminPelaku, "INTERFACE", "CREATE", logDesc)
	// ---------------

	return utils.Success(c, "success insert interface data", nil)
}

// GetInterfacesMonitoring mengambil semua data
func GetInterfacesMonitoring(c *fiber.Ctx) error {
	var interfaces []models.InterfaceMonitoring
	config.DB.Preload("Router").Where("is_deleted = ?", 0).Find(&interfaces)
	return utils.Success(c, "success retrieve interface data", interfaces)
}

// GetInterfaceMonitoring mengambil detail by ID
func GetInterfaceMonitoring(c *fiber.Ctx) error {
	id := c.Params("id")
	var iface models.InterfaceMonitoring

	result := config.DB.Where("interface_id = ? AND is_deleted = ?", id, 0).First(&iface)
	if result.Error != nil {
		return utils.Failed(c, "interface not found or deleted")
	}

	return utils.Success(c, "success retrieve interface data", iface)
}

// UpdateInterfaceMonitoring update konfigurasi monitoring
func UpdateInterfaceMonitoring(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)
	id := c.Params("id")

	var iface models.InterfaceMonitoring

	// Ambil data lama dulu (untuk log perbandingan, opsional)
	if err := config.DB.Preload("Router").Where("interface_id = ? AND is_deleted = ?", id, 0).First(&iface).Error; err != nil {
		return utils.Failed(c, "interface not found or deleted")
	}
	oldName := iface.InterfaceName
	oldRouter := iface.Router.RouterName

	var payload models.InterfaceMonitoring
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	if payload.InterfaceName == "" || payload.RouterID == uuid.Nil {
		return utils.Failed(c, "interface_name and router_id cannot be empty")
	}

	// Validasi Router Baru (jika ganti)
	var checkRouter models.Router
	if err := config.DB.First(&checkRouter, "router_id = ?", payload.RouterID).Error; err != nil {
		return utils.Failed(c, "Router ID tidak valid / tidak ditemukan")
	}

	// Cek Duplikat di Router Baru
	var checkDuplicate models.InterfaceMonitoring
	if err := config.DB.Where("router_id = ? AND interface_name = ? AND is_deleted = 0 AND interface_id != ?", payload.RouterID, payload.InterfaceName, id).First(&checkDuplicate).Error; err == nil {
		return utils.Failed(c, "Interface ini sudah digunakan oleh data monitoring lain!")
	}

	iface.InterfaceName = payload.InterfaceName
	iface.RouterID = payload.RouterID

	if err := config.DB.Save(&iface).Error; err != nil {
		return utils.Error(c, "failed to update interface data")
	}

	// --- LOGGING ---
	logDesc := fmt.Sprintf("Update Interface ID %s. Dari [%s @ %s] Menjadi [%s @ %s]", id, oldName, oldRouter, payload.InterfaceName, checkRouter.RouterName)
	utils.CreateLog(adminPelaku, "INTERFACE", "UPDATE", logDesc)
	// ---------------

	return utils.Success(c, "success update interface data", nil)
}

// DeleteInterfaceMonitoring soft delete monitoring
func DeleteInterfaceMonitoring(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)
	id := c.Params("id")

	var iface models.InterfaceMonitoring
	// Preload Router biar tau router mana yang dihapus monitoringnya
	if err := config.DB.Preload("Router").First(&iface, "interface_id = ?", id).Error; err != nil {
		return utils.Failed(c, "interface not found")
	}

	if iface.IsDeleted == 1 {
		return utils.Failed(c, "interface already deleted")
	}

	iface.IsDeleted = 1
	if err := config.DB.Save(&iface).Error; err != nil {
		return utils.Error(c, "failed to mark interface as deleted")
	}

	// --- LOGGING ---
	logDesc := fmt.Sprintf("Hapus Monitoring Interface: %s pada Router %s", iface.InterfaceName, iface.Router.RouterName)
	utils.CreateLog(adminPelaku, "INTERFACE", "DELETE", logDesc)
	// ---------------

	return utils.Success(c, "success soft delete interface", nil)
}

// GetInterfacesFromRouter scan interface real-time dari mikrotik
func GetInterfacesFromRouter(c *fiber.Ctx) error {
	// Fitur Scan biasanya tidak perlu dicatat log-nya karena hanya "Read",
	// tapi kalau mau dicatat juga boleh. Disini saya skip agar log tidak penuh sampah.

	routerID := c.Params("id")

	var router models.Router
	if err := config.DB.Where("router_id = ? AND is_deleted = 0", routerID).First(&router).Error; err != nil {
		return utils.Failed(c, "Router tidak ditemukan")
	}

	decryptedPass, err := utils.DecryptAES(router.RouterPassword)
	if err != nil {
		return utils.Failed(c, "Gagal dekripsi password")
	}

	interfaces, err := services.GetRouterInterfacesList(
		router.RouterAddress,
		router.RouterPort,
		router.RouterUsername,
		decryptedPass,
		router.RouterRemoteType,
	)

	if err != nil {
		return utils.Failed(c, err.Error())
	}

	return utils.Success(c, "Berhasil mengambil daftar interface", interfaces)
}
