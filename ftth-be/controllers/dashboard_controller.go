package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"

	"github.com/gofiber/fiber/v2"
)

// DashboardStatsResponse menyimpan data statistik dashboard
type DashboardStatsResponse struct {
	TotalRouter     int64 `json:"total_router"`
	ActiveRouter    int64 `json:"active_router"`
	OfflineRouter   int64 `json:"offline_router"`
	TotalClient     int64 `json:"total_client"`
	TotalOLT        int64 `json:"total_olt"`
	TotalODP        int64 `json:"total_odp"`
	TotalODC        int64 `json:"total_odc"`
	TotalCable      int64 `json:"total_cable"`
}

// GetDashboardStats mengembalikan statistik dashboard operasional secara riil dari database
func GetDashboardStats(c *fiber.Ctx) error {
	var totalRouter int64
	var activeRouter int64
	var totalClient int64
	var totalOLT int64
	var totalODP int64
	var totalODC int64
	var totalCable int64

	// 1. Hitung Router
	config.DB.Model(&models.Router{}).Where("is_deleted = 0").Count(&totalRouter)
	config.DB.Model(&models.Router{}).Where("is_deleted = 0 AND router_status = ?", "ONLINE").Count(&activeRouter)
	offlineRouter := totalRouter - activeRouter

	// 2. Hitung Nodes berdasarkan tipe
	config.DB.Model(&models.NetworkNode{}).Where("type = ?", "CLIENT").Count(&totalClient)
	config.DB.Model(&models.NetworkNode{}).Where("type = ?", "OLT").Count(&totalOLT)
	config.DB.Model(&models.NetworkNode{}).Where("type = ?", "ODP").Count(&totalODP)
	config.DB.Model(&models.NetworkNode{}).Where("type = ?", "ODC").Count(&totalODC)

	// 3. Hitung Kabel
	config.DB.Model(&models.NetworkCable{}).Count(&totalCable)

	stats := DashboardStatsResponse{
		TotalRouter:     totalRouter,
		ActiveRouter:    activeRouter,
		OfflineRouter:   offlineRouter,
		TotalClient:     totalClient,
		TotalOLT:        totalOLT,
		TotalODP:        totalODP,
		TotalODC:        totalODC,
		TotalCable:      totalCable,
	}

	return utils.Success(c, "Statistik dashboard berhasil diambil", stats)
}

// GetDashboardLogs mengembalikan daftar log operasional aktivitas admin/sistem terbaru
func GetDashboardLogs(c *fiber.Ctx) error {
	var logs []models.Log
	
	// Ambil 10 log terbaru dari database
	if err := config.DB.Order("created_at desc").Limit(10).Find(&logs).Error; err != nil {
		return utils.Failed(c, "Gagal mengambil log aktivitas: "+err.Error())
	}

	return utils.Success(c, "Log aktivitas dashboard berhasil diambil", logs)
}
