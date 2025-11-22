package controllers

import (
	services "akane/be-ftth/Services"
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"time" // Diperlukan untuk set Timestamp

	"github.com/gofiber/fiber/v2"
)

// ## Fungsi-fungsi InterfaceTraffic ##

// CreateInterfaceTraffic membuat data traffic baru
func CreateInterfaceTraffic(c *fiber.Ctx) error {
	var traffic models.InterfaceTraffic
	if err := c.BodyParser(&traffic); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	// Validasi input
	if traffic.InterfaceID == 0 {
		return utils.Failed(c, "interface_id is required")
	}

	// Validasi penting: Pastikan parent interface-nya ada
	var iface models.InterfaceMonitoring
	if err := config.DB.First(&iface, "interface_id = ? AND is_deleted = ?", traffic.InterfaceID, 0).Error; err != nil {
		return utils.Failed(c, "parent interface not found or deleted")
	}

	// Mengikuti pola user_controller (set default), kita set Timestamp
	// jika tidak disediakan di body request.
	// Model Anda sudah punya 'autoCreateTime', tapi ini memberi fleksibilitas
	// jika Anda ingin mengirim data traffic historis (dengan timestamp spesifik).
	if traffic.Timestamp.IsZero() {
		traffic.Timestamp = time.Now()
	}

	if err := config.DB.Create(&traffic).Error; err != nil {
		return utils.Error(c, "failed to insert traffic data")
	}

	return utils.Success(c, "success insert traffic data", nil)
}

// GetInterfacesTraffic mengambil SEMUA data traffic (hati-hati, bisa sangat besar)
func GetInterfacesTraffic(c *fiber.Ctx) error {
	var traffic []models.InterfaceTraffic
	config.DB.Where("is_deleted = ?", 0).Order("timestamp desc").Find(&traffic)
	return utils.Success(c, "success retrieve all traffic data", traffic)
}

// GetTrafficForInterface mengambil data traffic untuk SATU interface tertentu
// Ini fungsi kustom yang lebih praktis daripada GetInterfacesTraffic
// Anda bisa routing ini ke: /api/traffic/interface/:interface_id
func GetTrafficForInterface(c *fiber.Ctx) error {
	interfaceId := c.Params("interface_id") // Ambil ID interface dari URL
	if interfaceId == "" {
		return utils.Failed(c, "interface_id parameter is required")
	}

	var traffic []models.InterfaceTraffic
	// Cari semua traffic yang 'interface_id'-nya cocok dan tidak di-soft-delete
	// Diurutkan dari yang terbaru
	result := config.DB.Where("interface_id = ? AND is_deleted = ?", interfaceId, 0).Order("timestamp desc").Find(&traffic)
	if result.Error != nil {
		return utils.Error(c, "failed to retrieve traffic data")
	}

	return utils.Success(c, "success retrieve traffic data for interface", traffic)
}

// GetInterfaceTraffic mengambil satu data traffic berdasarkan ID-nya (TrafficID)
func GetInterfaceTraffic(c *fiber.Ctx) error {
	id := c.Params("id") // Ini adalah traffic_id
	var traffic models.InterfaceTraffic

	result := config.DB.Where("traffic_id = ? AND is_deleted = ?", id, 0).First(&traffic)
	if result.Error != nil {
		return utils.Failed(c, "traffic record not found or deleted")
	}

	return utils.Success(c, "success retrieve traffic data", traffic)
}

// UpdateInterfaceTraffic memperbarui data traffic
// (Catatan: Ini jarang dilakukan. Biasanya data traffic bersifat "append-only")
func UpdateInterfaceTraffic(c *fiber.Ctx) error {
	id := c.Params("id") // traffic_id
	var traffic models.InterfaceTraffic

	// 1. Cari data
	if err := config.DB.Where("traffic_id = ? AND is_deleted = ?", id, 0).First(&traffic).Error; err != nil {
		return utils.Failed(c, "traffic record not found or deleted")
	}

	// 2. Parse payload
	var payload models.InterfaceTraffic
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	// 3. Timpa field (asumsi hanya speed yang bisa di-update)
	traffic.DownloadSpeed = payload.DownloadSpeed
	traffic.UploadSpeed = payload.UploadSpeed
	// Anda mungkin tidak ingin mengizinkan perubahan 'InterfaceID' atau 'Timestamp'

	// 4. Simpan
	if err := config.DB.Save(&traffic).Error; err != nil {
		return utils.Error(c, "failed to update traffic data")
	}

	return utils.Success(c, "success update traffic data", nil)
}

// DeleteInterfaceTraffic melakukan soft delete pada data traffic
func DeleteInterfaceTraffic(c *fiber.Ctx) error {
	id := c.Params("id") // traffic_id

	var traffic models.InterfaceTraffic
	if err := config.DB.First(&traffic, "traffic_id = ?", id).Error; err != nil {
		return utils.Failed(c, "traffic record not found")
	}

	if traffic.IsDeleted == 1 {
		return utils.Failed(c, "traffic record already deleted")
	}

	traffic.IsDeleted = 1
	if err := config.DB.Save(&traffic).Error; err != nil {
		return utils.Error(c, "failed to mark traffic record as deleted")
	}

	return utils.Success(c, "success soft delete traffic record", nil)
}

func ManualTrafficSync(c *fiber.Ctx) error {
	// Kita jalankan di background (goroutine) agar request tidak timeout jika routernya banyak
	// Tapi jika ingin user menunggu hasilnya, hilangkan 'go'

	// Opsi A: Tunggu sampai selesai (User loading lama tapi pasti)
	err := services.RunTrafficSyncJob()
	if err != nil {
		return utils.Error(c, "Gagal melakukan sinkronisasi: "+err.Error())
	}

	return utils.Success(c, "Sinkronisasi data traffic berhasil", nil)
}
