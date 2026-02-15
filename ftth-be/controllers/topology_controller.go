package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"

	"github.com/gofiber/fiber/v2"
)

// 1. Ambil Semua Data Topology
func GetNetworkTopology(c *fiber.Ctx) error {
	var nodes []models.NetworkNode
	var cables []models.NetworkCable

	// Ambil Nodes
	config.DB.Find(&nodes)

	// Ambil Cables dengan Preload Node info nya
	config.DB.Preload("SourceNode").Preload("TargetNode").Find(&cables)

	return utils.Success(c, "Data topology loaded", map[string]interface{}{
		"nodes":  nodes,
		"cables": cables,
	})
}

// 2. Tambah Node Baru (OLT/ODC/ODP)
func AddNetworkNode(c *fiber.Ctx) error {
	var node models.NetworkNode
	if err := c.BodyParser(&node); err != nil {
		return utils.Failed(c, "Invalid body")
	}
	if err := config.DB.Create(&node).Error; err != nil {
		return utils.Failed(c, err.Error())
	}
	return utils.Success(c, "Node created", node)
}

// 3. Tambah Kabel (Hubungkan 2 Node)
func AddNetworkCable(c *fiber.Ctx) error {
	var cable models.NetworkCable
	if err := c.BodyParser(&cable); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	// Validasi sederhana: Source dan Target tidak boleh sama
	if cable.SourceNodeID == cable.TargetNodeID {
		return utils.Failed(c, "Source and Target cannot be same")
	}

	if err := config.DB.Create(&cable).Error; err != nil {
		return utils.Failed(c, err.Error())
	}
	return utils.Success(c, "Cable created", cable)
}

func UpdateCablePath(c *fiber.Ctx) error {
	id := c.Params("id")

	// Struct khusus untuk menangkap body JSON array coordinate
	type UpdatePathRequest struct {
		Coordinates string  `json:"coordinates"` // String JSON "[[x,y],[x,y]]"
		Length      float64 `json:"length_meter"`
	}

	var req UpdatePathRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	var cable models.NetworkCable
	if err := config.DB.First(&cable, id).Error; err != nil {
		return utils.Failed(c, "Cable not found")
	}

	// Update Data
	cable.Coordinates = req.Coordinates
	cable.LengthMeter = req.Length

	config.DB.Save(&cable)

	return utils.Success(c, "Jalur kabel berhasil disimpan", cable)
}
