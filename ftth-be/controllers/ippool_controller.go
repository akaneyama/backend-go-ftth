package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"
	"net"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// GetIPPools mengambil semua data IP Pool
func GetIPPools(c *fiber.Ctx) error {
	var pools []models.IPPool
	if err := config.DB.Preload("Router").Find(&pools).Error; err != nil {
		return utils.Error(c, "Gagal memuat data IP Pool: "+err.Error())
	}
	return utils.Success(c, "Berhasil memuat IP Pool", pools)
}

// GetIPPool mengambil satu data IP Pool
func GetIPPool(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID IP Pool tidak valid.")
	}

	var pool models.IPPool
	if err := config.DB.Preload("Router").First(&pool, "id = ?", id).Error; err != nil {
		return utils.Failed(c, "IP Pool tidak ditemukan.")
	}

	return utils.Success(c, "Berhasil memuat IP Pool", pool)
}

// CreateIPPool membuat IP Pool baru
func CreateIPPool(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	type IPPoolRequest struct {
		Name     string  `json:"name"`
		Subnet   string  `json:"subnet"`
		Gateway  string  `json:"gateway"`
		RouterID *string `json:"router_id,omitempty"`
	}

	var req IPPoolRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Format request tidak valid.")
	}

	if req.Name == "" || req.Subnet == "" || req.Gateway == "" {
		return utils.Failed(c, "Nama, Subnet, dan Gateway wajib diisi.")
	}

	// Validasi Subnet format
	_, _, err := net.ParseCIDR(req.Subnet)
	if err != nil {
		return utils.Failed(c, "Format Subnet tidak valid. Contoh: 192.168.10.0/24")
	}

	pool := models.IPPool{
		Name:    req.Name,
		Subnet:  req.Subnet,
		Gateway: req.Gateway,
	}

	if req.RouterID != nil && *req.RouterID != "" {
		pool.RouterID = req.RouterID
	}

	if err := config.DB.Create(&pool).Error; err != nil {
		return utils.Error(c, "Gagal menyimpan IP Pool: "+err.Error())
	}

	utils.CreateLog(adminPelaku, "IPPOOL", "INFO", fmt.Sprintf("Membuat IP Pool baru: %s", pool.Name))
	return utils.Success(c, "IP Pool berhasil ditambahkan.", pool)
}

// UpdateIPPool memperbarui IP Pool
func UpdateIPPool(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID IP Pool tidak valid.")
	}

	var pool models.IPPool
	if err := config.DB.First(&pool, "id = ?", id).Error; err != nil {
		return utils.Failed(c, "IP Pool tidak ditemukan.")
	}

	type IPPoolRequest struct {
		Name     string  `json:"name"`
		Subnet   string  `json:"subnet"`
		Gateway  string  `json:"gateway"`
		RouterID *string `json:"router_id"`
	}

	var req IPPoolRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Format request tidak valid.")
	}

	if req.Name != "" {
		pool.Name = req.Name
	}
	if req.Subnet != "" {
		_, _, err := net.ParseCIDR(req.Subnet)
		if err != nil {
			return utils.Failed(c, "Format Subnet tidak valid. Contoh: 192.168.10.0/24")
		}
		pool.Subnet = req.Subnet
	}
	if req.Gateway != "" {
		pool.Gateway = req.Gateway
	}
	if req.RouterID != nil && *req.RouterID != "" {
		pool.RouterID = req.RouterID
	} else if req.RouterID != nil && *req.RouterID == "" {
		pool.RouterID = nil
	}

	if err := config.DB.Save(&pool).Error; err != nil {
		return utils.Error(c, "Gagal memperbarui IP Pool: "+err.Error())
	}

	utils.CreateLog(adminPelaku, "IPPOOL", "INFO", fmt.Sprintf("Memperbarui IP Pool ID %d", id))
	return utils.Success(c, "IP Pool berhasil diperbarui.", pool)
}

// DeleteIPPool menghapus IP Pool
func DeleteIPPool(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID IP Pool tidak valid.")
	}

	var pool models.IPPool
	if err := config.DB.First(&pool, "id = ?", id).Error; err != nil {
		return utils.Failed(c, "IP Pool tidak ditemukan.")
	}

	if err := config.DB.Delete(&pool).Error; err != nil {
		return utils.Error(c, "Gagal menghapus IP Pool: "+err.Error())
	}

	utils.CreateLog(adminPelaku, "IPPOOL", "INFO", fmt.Sprintf("Menghapus IP Pool: %s", pool.Name))
	return utils.Success(c, "IP Pool berhasil dihapus.", nil)
}

// GetAvailableIPs mendapatkan IP yang tersedia dalam pool tertentu (yang tidak terpakai oleh Client)
func GetAvailableIPs(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.Failed(c, "ID IP Pool tidak valid.")
	}

	var pool models.IPPool
	if err := config.DB.First(&pool, "id = ?", id).Error; err != nil {
		return utils.Failed(c, "IP Pool tidak ditemukan.")
	}

	// 1. Generate all IPs from subnet
	ip, ipnet, err := net.ParseCIDR(pool.Subnet)
	if err != nil {
		return utils.Error(c, "Format subnet tidak valid di database.")
	}

	var ips []string
	for ip := ip.Mask(ipnet.Mask); ipnet.Contains(ip); inc(ip) {
		ips = append(ips, ip.String())
	}

	// Remove network address and broadcast address
	if len(ips) > 2 {
		ips = ips[1 : len(ips)-1]
	}

	// Filter out gateway
	var usableIps []string
	for _, i := range ips {
		if i != pool.Gateway {
			usableIps = append(usableIps, i)
		}
	}

	// 2. Fetch used IPs from Clients
	var clients []models.Client
	config.DB.Select("ip_address").Where("ip_address != ''").Find(&clients)

	usedIpsMap := make(map[string]bool)
	for _, client := range clients {
		// In case IP contains subnet mask in db (e.g. 192.168.1.2/24)
		cleanIP := strings.Split(client.IPAddress, "/")[0]
		usedIpsMap[cleanIP] = true
	}

	// 3. Filter usable IPs
	var availableIps []string
	for _, i := range usableIps {
		if !usedIpsMap[i] {
			availableIps = append(availableIps, i)
		}
	}

	return utils.Success(c, "Berhasil mendapatkan IP yang tersedia", availableIps)
}

// Helper untuk increment IP address
func inc(ip net.IP) {
	for j := len(ip) - 1; j >= 0; j-- {
		ip[j]++
		if ip[j] > 0 {
			break
		}
	}
}
