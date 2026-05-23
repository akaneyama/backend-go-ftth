package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// GetTopologyMappings mengambil semua pemetaan jaringan
func GetTopologyMappings(c *fiber.Ctx) error {
	var mappings []models.TopologyMapping

	err := config.DB.
		Preload("Router").
		Preload("OLTNode").
		Preload("ODCNode").
		Preload("ODPNode").
		Find(&mappings).Error

	if err != nil {
		return utils.Error(c, "Gagal mengambil data pemetaan: "+err.Error())
	}

	return utils.Success(c, "Berhasil mengambil data pemetaan", mappings)
}

// GetTopologyMapping mengambil satu pemetaan detail
func GetTopologyMapping(c *fiber.Ctx) error {
	id := c.Params("id")
	var mapping models.TopologyMapping

	err := config.DB.
		Preload("Router").
		Preload("OLTNode").
		Preload("ODCNode").
		Preload("ODPNode").
		First(&mapping, id).Error

	if err != nil {
		return utils.Failed(c, "Pemetaan tidak ditemukan")
	}

	return utils.Success(c, "Berhasil mengambil pemetaan detail", mapping)
}

// CreateTopologyMapping membuat pemetaan jaringan baru
func CreateTopologyMapping(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	var payload struct {
		RouterID  string `json:"router_id"`
		OLTNodeID int    `json:"olt_node_id"`
		ODCNodeID int    `json:"odc_node_id"`
		ODPNodeID int    `json:"odp_node_id"`
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "Invalid request body")
	}

	if payload.RouterID == "" || payload.OLTNodeID == 0 || payload.ODCNodeID == 0 || payload.ODPNodeID == 0 {
		return utils.Failed(c, "Semua field (Mikrotik, OLT, ODC, ODP) harus diisi!")
	}

	// Cek apakah ODP sudah terpetakan sebelumnya
	var count int64
	config.DB.Model(&models.TopologyMapping{}).Where("odp_node_id = ?", payload.ODPNodeID).Count(&count)
	if count > 0 {
		return utils.Failed(c, "Node ODP tersebut sudah dipetakan di jalur lain!")
	}

	mapping := models.TopologyMapping{
		RouterID:  payload.RouterID,
		OLTNodeID: payload.OLTNodeID,
		ODCNodeID: payload.ODCNodeID,
		ODPNodeID: payload.ODPNodeID,
	}

	if err := config.DB.Create(&mapping).Error; err != nil {
		return utils.Error(c, "Gagal membuat pemetaan: "+err.Error())
	}

	// Ambil detail nama ODP untuk log
	var odpNode models.NetworkNode
	config.DB.First(&odpNode, payload.ODPNodeID)

	// LOGGING
	logDesc := fmt.Sprintf("Tambah Pemetaan Jaringan Baru untuk ODP: %s", odpNode.Name)
	utils.CreateLog(adminPelaku, "TOPOLOGY_MAPPING", "CREATE", logDesc)

	return utils.Success(c, "Berhasil menambahkan pemetaan baru", mapping)
}

// UpdateTopologyMapping memperbarui pemetaan jaringan
func UpdateTopologyMapping(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)
	id := c.Params("id")

	var mapping models.TopologyMapping
	if err := config.DB.First(&mapping, id).Error; err != nil {
		return utils.Failed(c, "Pemetaan tidak ditemukan")
	}

	var payload struct {
		RouterID  string `json:"router_id"`
		OLTNodeID int    `json:"olt_node_id"`
		ODCNodeID int    `json:"odc_node_id"`
		ODPNodeID int    `json:"odp_node_id"`
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "Invalid request body")
	}

	if payload.RouterID == "" || payload.OLTNodeID == 0 || payload.ODCNodeID == 0 || payload.ODPNodeID == 0 {
		return utils.Failed(c, "Semua field (Mikrotik, OLT, ODC, ODP) harus diisi dan valid")
	}

	// Cek jika ODP sudah terpetakan di mapping lain (selain mapping saat ini)
	var count int64
	config.DB.Model(&models.TopologyMapping{}).
		Where("odp_node_id = ? AND mapping_id != ?", payload.ODPNodeID, id).
		Count(&count)
	if count > 0 {
		return utils.Failed(c, "Node ODP tersebut sudah dipetakan di jalur lain!")
	}

	mapping.RouterID = payload.RouterID
	mapping.OLTNodeID = payload.OLTNodeID
	mapping.ODCNodeID = payload.ODCNodeID
	mapping.ODPNodeID = payload.ODPNodeID

	if err := config.DB.Save(&mapping).Error; err != nil {
		return utils.Failed(c, "Gagal memperbarui pemetaan: "+err.Error())
	}

	// Ambil detail nama ODP untuk log
	var odpNode models.NetworkNode
	config.DB.First(&odpNode, payload.ODPNodeID)

	// LOGGING
	logDesc := fmt.Sprintf("Update Pemetaan Jaringan ID %s untuk ODP: %s", id, odpNode.Name)
	utils.CreateLog(adminPelaku, "TOPOLOGY_MAPPING", "UPDATE", logDesc)

	return utils.Success(c, "Berhasil memperbarui pemetaan", mapping)
}

// DeleteTopologyMapping menghapus pemetaan jaringan
func DeleteTopologyMapping(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)
	id := c.Params("id")

	var mapping models.TopologyMapping
	if err := config.DB.Preload("ODPNode").First(&mapping, id).Error; err != nil {
		return utils.Failed(c, "Pemetaan tidak ditemukan")
	}

	odpName := "Unknown"
	if mapping.ODPNode != nil {
		odpName = mapping.ODPNode.Name
	}

	if err := config.DB.Delete(&mapping).Error; err != nil {
		return utils.Error(c, "Gagal menghapus pemetaan")
	}

	// LOGGING
	logDesc := fmt.Sprintf("Hapus Pemetaan Jaringan untuk ODP: %s (ID: %s)", odpName, id)
	utils.CreateLog(adminPelaku, "TOPOLOGY_MAPPING", "DELETE", logDesc)

	return utils.Success(c, "Berhasil menghapus pemetaan", nil)
}

// GetRouterByODPName mengambil router ID berdasarkan nama ODP (misalnya saat autocomplete pelanggan)
func GetRouterByODPName(c *fiber.Ctx) error {
	name := c.Params("name")

	var mapping models.TopologyMapping
	err := config.DB.
		Joins("INNER JOIN network_nodes ON network_nodes.node_id = topology_mappings.odp_node_id").
		Where("network_nodes.type = 'ODP' AND network_nodes.name = ?", name).
		First(&mapping).Error

	if err != nil {
		return utils.Failed(c, "Jalur pemetaan untuk area ODP ini belum didefinisikan!")
	}

	return utils.Success(c, "Berhasil menemukan router untuk ODP ini", map[string]interface{}{
		"router_id": mapping.RouterID,
	})
}
