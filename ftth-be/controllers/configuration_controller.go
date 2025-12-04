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

// Request Body (Sudah Disederhanakan)
type ConfigRequest struct {
	RouterID   uuid.UUID `json:"router_id"`
	PackageID  int       `json:"package_id"`
	ConfigType string    `json:"config_type"`

	// Settingan Tambahan
	DNS1    string `json:"dns_1"`
	DNS2    string `json:"dns_2"`
	OnlyOne string `json:"only_one"`
}

// GetRouterResources: Hanya ambil Queue Type
func GetRouterResources(c *fiber.Ctx) error {
	routerID := c.Params("id")

	var router models.Router
	if err := config.DB.Where("router_id = ? AND is_deleted = 0", routerID).First(&router).Error; err != nil {
		return utils.Failed(c, "Router tidak ditemukan")
	}

	decryptedPass, err := utils.DecryptAES(router.RouterPassword)
	if err != nil {
		return utils.Failed(c, "Gagal dekripsi password")
	}

	// Panggil Service (Updated)
	resources, err := services.GetRouterResources(
		router.RouterAddress,
		router.RouterPort,
		router.RouterUsername,
		decryptedPass,
		router.RouterRemoteType,
	)

	if err != nil {
		return utils.Failed(c, "Gagal scan resource: "+err.Error())
	}

	return utils.Success(c, "Berhasil mengambil resource", resources)
}

// Push Config
func ConfigureRouterProfile(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	var req ConfigRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Invalid request body")
	}

	if req.RouterID == uuid.Nil || req.PackageID == 0 || req.ConfigType == "" {
		return utils.Failed(c, "Router, Paket, dan Tipe Konfigurasi harus diisi")
	}

	var router models.Router
	config.DB.Where("router_id = ?", req.RouterID).First(&router)
	var pkg models.Internetpackage
	config.DB.Where("package_id = ?", req.PackageID).First(&pkg)
	pass, _ := utils.DecryptAES(router.RouterPassword)

	// Mapping Settingan (Sederhana)
	pppSettings := services.PPPoESettings{
		DNS1:    req.DNS1,
		DNS2:    req.DNS2,
		OnlyOne: req.OnlyOne,
	}

	err := services.ConfigureProfileOnRouter(
		router.RouterAddress,
		router.RouterPort,
		router.RouterUsername,
		pass,
		router.RouterRemoteType,
		req.ConfigType,
		pkg.PackageName,
		pkg.PackageLimit,
		pppSettings,
	)

	if err != nil {
		logDesc := fmt.Sprintf("Gagal setting %s profile '%s'. Error: %v", req.ConfigType, pkg.PackageName, err)
		utils.CreateLog(adminPelaku, "CONFIGURATION", "ERROR", logDesc)
		return utils.Failed(c, err.Error())
	}

	logDesc := fmt.Sprintf("Sukses push profile %s '%s' (Q: %s) ke %s", req.ConfigType, pkg.PackageName, router.RouterName)
	utils.CreateLog(adminPelaku, "CONFIGURATION", "SUCCESS", logDesc)

	return utils.Success(c, "Konfigurasi profile berhasil diterapkan", nil)
}
