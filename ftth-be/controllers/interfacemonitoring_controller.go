package controllers

import (
	services "akane/be-ftth/Services"
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

	// 1. Validasi Field Kosong
	if iface.InterfaceName == "" || iface.RouterID == uuid.Nil {
		return utils.Failed(c, "interface_name and router_id are required")
	}

	// 2. Validasi Router ID Benar-benar Ada
	var router models.Router
	if err := config.DB.First(&router, "router_id = ?", iface.RouterID).Error; err != nil {
		return utils.Failed(c, "router_id not found")
	}

	// 3. [BARU] Validasi Duplikat
	// Cek apakah interface ini SUDAH dimonitoring di router yang sama (dan belum dihapus)
	var checkDuplicate models.InterfaceMonitoring
	if err := config.DB.Where("router_id = ? AND interface_name = ? AND is_deleted = 0", iface.RouterID, iface.InterfaceName).First(&checkDuplicate).Error; err == nil {
		// Jika err == nil, berarti data DITEMUKAN (Duplikat)
		return utils.Failed(c, "Interface ini sudah dimonitoring pada router tersebut!")
	}

	if err := config.DB.Create(&iface).Error; err != nil {
		return utils.Error(c, "failed to insert interface data")
	}

	return utils.Success(c, "success insert interface data", nil)
}

// GetInterfacesMonitoring mengambil semua data interface yang tidak terhapus
func GetInterfacesMonitoring(c *fiber.Ctx) error {
	var interfaces []models.InterfaceMonitoring
	// Tambahkan Preload disini
	config.DB.Preload("Router").Where("is_deleted = ?", 0).Find(&interfaces)
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

	// 1. Cari dulu data yang mau diedit
	if err := config.DB.Where("interface_id = ? AND is_deleted = ?", id, 0).First(&iface).Error; err != nil {
		return utils.Failed(c, "interface not found or deleted")
	}

	// 2. Parse payload baru
	var payload models.InterfaceMonitoring
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	// 3. [BARU] Validasi Input Kosong saat Update
	if payload.InterfaceName == "" || payload.RouterID == uuid.Nil {
		return utils.Failed(c, "interface_name and router_id cannot be empty")
	}

	// 4. [BARU] Validasi Router ID Baru Ada (Jika diganti)
	var checkRouter models.Router
	if err := config.DB.First(&checkRouter, "router_id = ?", payload.RouterID).Error; err != nil {
		return utils.Failed(c, "Router ID tidak valid / tidak ditemukan")
	}

	// 5. [BARU] Validasi Duplikat (Penting!)
	// Cek apakah ada data LAIN (selain ID yang sedang diedit) yang punya RouterID & InterfaceName sama
	var checkDuplicate models.InterfaceMonitoring
	if err := config.DB.Where("router_id = ? AND interface_name = ? AND is_deleted = 0 AND interface_id != ?", payload.RouterID, payload.InterfaceName, id).First(&checkDuplicate).Error; err == nil {
		// Jika ketemu data lain dengan nama sama, tolak request
		return utils.Failed(c, "Interface ini sudah digunakan oleh data monitoring lain!")
	}

	// 6. Update Data
	iface.InterfaceName = payload.InterfaceName
	iface.RouterID = payload.RouterID

	// 7. Simpan perubahan
	if err := config.DB.Save(&iface).Error; err != nil {
		return utils.Error(c, "failed to update interface data")
	}

	return utils.Success(c, "success update interface data", nil)
}

// DeleteInterfaceMonitoring melakukan soft delete pada interface
func DeleteInterfaceMonitoring(c *fiber.Ctx) error {
	id := c.Params("id")

	var iface models.InterfaceMonitoring
	// 1. Cari data
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

func GetInterfacesFromRouter(c *fiber.Ctx) error {
	routerID := c.Params("id") // ID Router

	// 1. Ambil data router dari DB
	var router models.Router
	if err := config.DB.Where("router_id = ? AND is_deleted = 0", routerID).First(&router).Error; err != nil {
		return utils.Failed(c, "Router tidak ditemukan")
	}

	// 2. Decrypt Password
	decryptedPass, err := utils.DecryptAES(router.RouterPassword)
	if err != nil {
		return utils.Failed(c, "Gagal dekripsi password")
	}

	// 3. Panggil Service Mikrotik
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
