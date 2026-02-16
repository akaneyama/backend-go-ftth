package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func SearchNetworkNodes(c *fiber.Ctx) error {
	query := c.Query("q") // Ambil query param ?q=nama_node

	var nodes []models.NetworkNode

	// Cari nama yang mirip (ILIKE untuk Postgres, LIKE untuk MySQL)
	// Gunakan LOWER() agar case-insensitive
	if query == "" {
		return utils.Failed(c, "Query parameter 'q' is required")
	}

	err := config.DB.Where("LOWER(name) LIKE ? OR type = ?", "%"+strings.ToLower(query)+"%", strings.ToUpper(query)).Find(&nodes).Error

	if err != nil {
		return utils.Failed(c, "Error searching nodes")
	}

	return utils.Success(c, "Search results", nodes)
}

// 1. Ambil Semua Data Topology

func GetNetworkTopology(c *fiber.Ctx) error {
	var nodes []models.NetworkNode
	var cables []models.NetworkCable

	// 1. Ambil Nodes dengan detail asetnya
	if err := config.DB.
		Preload("ODPDetail").
		Preload("OLTDetail").
		Preload("ODCDetail").
		Preload("ClientDetail").
		Find(&nodes).Error; err != nil {
		return utils.Failed(c, err.Error())
	}

	// 2. Ambil Cables
	config.DB.Preload("SourceNode").Preload("TargetNode").Find(&cables)

	// 3. LOGIC CAPACITY PLANNING (PERBAIKAN)
	// Kita hitung manual query count agar akurat (Source OR Target)
	for i := range nodes {
		// Jika Node ini adalah ODP
		if nodes[i].Type == models.TypeODP && nodes[i].ODPDetail != nil {
			var count int64

			// Hitung ada berapa kabel yang nyolok ke Node ID ini
			// Baik sebagai Source maupun Target
			config.DB.Model(&models.NetworkCable{}).
				Where("source_node_id = ? OR target_node_id = ?", nodes[i].NodeID, nodes[i].NodeID).
				Count(&count)

			// Masukkan hasil hitungan ke struct (Memory only, tidak save DB)
			// Agar dikirim ke Frontend dengan angka terbaru
			nodes[i].ODPDetail.UsedPorts = int(count)
		}
	}

	return utils.Success(c, "Data topology loaded", map[string]interface{}{
		"nodes":  nodes,
		"cables": cables,
	})
}

// 2. Tambah Node Baru (OLT/ODC/ODP)
func AddNetworkNode(c *fiber.Ctx) error {
	// Struct input dari frontend bisa punya field tambahan
	type AddNodeRequest struct {
		models.NetworkNode
		// Field tambahan untuk ODP/OLT jika user input saat create
		TotalPorts int    `json:"total_ports"` // Untuk ODP
		Brand      string `json:"brand"`       // Untuk OLT
	}

	var req AddNodeRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	// Validasi dasar
	if req.Latitude == 0 || req.Longitude == 0 {
		return utils.Failed(c, "Koordinat wajib diisi")
	}

	// GUNAKAN TRANSACTION
	// Agar jika gagal simpan di tabel ODP, data di Map juga batal (atomik)
	err := config.DB.Transaction(func(tx *gorm.DB) error {

		// 1. Simpan Node Utama (Map)
		node := req.NetworkNode
		if err := tx.Create(&node).Error; err != nil {
			return err
		}

		// 2. Simpan ke Tabel Spesifik berdasarkan Type
		switch node.Type {
		case models.TypeODP:
			// Default port 8 jika tidak diisi
			ports := 8
			if req.TotalPorts > 0 {
				ports = req.TotalPorts
			}

			odp := models.ODP{NodeID: node.NodeID, TotalPorts: ports}
			if err := tx.Create(&odp).Error; err != nil {
				return err
			}

		case models.TypeOLT:
			olt := models.OLT{NodeID: node.NodeID, Brand: req.Brand}
			if err := tx.Create(&olt).Error; err != nil {
				return err
			}

		case models.TypeODC:
			odc := models.ODC{NodeID: node.NodeID, Capacity: 144} // Default
			if err := tx.Create(&odc).Error; err != nil {
				return err
			}

		case models.TypeClient:
			client := models.ClientNode{NodeID: node.NodeID, SubscriberID: "NEW"}
			if err := tx.Create(&client).Error; err != nil {
				return err
			}

			// ROUTER dan TB biarkan saja di map node, atau buat tabel sendiri jika perlu
		}

		return nil
	})

	if err != nil {
		return utils.Failed(c, "Gagal membuat node: "+err.Error())
	}

	return utils.Success(c, "Node berhasil dibuat dan disinkronkan", nil)
}

func UpdateNetworkNode(c *fiber.Ctx) error {
	id := c.Params("id")
	var input models.NetworkNode

	if err := c.BodyParser(&input); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	var node models.NetworkNode
	if err := config.DB.First(&node, id).Error; err != nil {
		return utils.Failed(c, "Node not found")
	}

	// Update field yang diizinkan
	node.Name = input.Name
	node.Description = input.Description
	node.Latitude = input.Latitude
	node.Longitude = input.Longitude
	// Tipe jarang berubah, tapi jika perlu bisa diuncomment:
	// node.Type = input.Type

	config.DB.Save(&node)
	return utils.Success(c, "Node updated", node)
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
func UpdateNodeDetails(c *fiber.Ctx) error {
	id := c.Params("id")

	type UpdateDetailReq struct {
		Type       string `json:"type"`
		TotalPorts int    `json:"total_ports"`   // ODP
		Brand      string `json:"brand"`         // OLT
		Subscriber string `json:"subscriber_id"` // Client
	}

	var req UpdateDetailReq
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	// Cari Node ID integer
	var node models.NetworkNode
	if err := config.DB.First(&node, id).Error; err != nil {
		return utils.Failed(c, "Node not found")
	}

	if req.Type == "ODP" {
		var odp models.ODP
		config.DB.Where("node_id = ?", node.NodeID).First(&odp)
		odp.TotalPorts = req.TotalPorts
		config.DB.Save(&odp)
	} else if req.Type == "OLT" {
		var olt models.OLT
		config.DB.Where("node_id = ?", node.NodeID).First(&olt)
		olt.Brand = req.Brand
		config.DB.Save(&olt)
	}

	return utils.Success(c, "Detail aset berhasil diupdate", nil)
}
