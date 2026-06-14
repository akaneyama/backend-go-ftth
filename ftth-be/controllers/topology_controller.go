package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ==========================================
// SEARCH
// ==========================================

func SearchNetworkNodes(c *fiber.Ctx) error {
	query := c.Query("q")
	if query == "" {
		return utils.Failed(c, "Query parameter 'q' is required")
	}

	var nodes []models.NetworkNode
	err := config.DB.
		Preload("ODPDetail").
		Preload("OLTDetail").
		Preload("ODCDetail").
		Preload("ClientDetail").
		Where("LOWER(name) LIKE ? OR type = ?",
			"%"+strings.ToLower(query)+"%",
			strings.ToUpper(query),
		).Find(&nodes).Error

	if err != nil {
		return utils.Failed(c, "Error searching nodes")
	}
	return utils.Success(c, "Search results", nodes)
}

// ==========================================
// GET TOPOLOGY (MAP)
// ==========================================

func GetNetworkTopology(c *fiber.Ctx) error {
	var nodes []models.NetworkNode
	var cables []models.NetworkCable

	// 1. Ambil semua nodes + preload detail aset
	// Exclude CLIENT nodes yang pelanggannya sudah diputus (soft-deleted di tabel clients)
	if err := config.DB.
		Preload("ODPDetail").
		Preload("OLTDetail").
		Preload("ODCDetail").
		Preload("ClientDetail").
		Where(`
			type != 'CLIENT'
			OR (
				type = 'CLIENT' AND NOT EXISTS (
					SELECT 1 FROM client_nodes cn
					INNER JOIN clients c ON c.client_id = CAST(cn.subscriber_id AS UNSIGNED)
					WHERE cn.node_id = network_nodes.node_id AND c.deleted_at IS NOT NULL
				)
			)
		`).
		Find(&nodes).Error; err != nil {
		return utils.Failed(c, err.Error())
	}

	// 2. Ambil cables
	if err := config.DB.Preload("SourceNode").Preload("TargetNode").Find(&cables).Error; err != nil {
		return utils.Failed(c, err.Error())
	}

	// 2a. Saring cables agar koneksi ke node yang disembunyikan (misal CLIENT soft-deleted) ikut disembunyikan
	activeNodeIDs := make(map[int]bool)
	for _, node := range nodes {
		activeNodeIDs[node.NodeID] = true
	}
	activeCables := []models.NetworkCable{}
	for _, cable := range cables {
		if activeNodeIDs[cable.SourceNodeID] && activeNodeIDs[cable.TargetNodeID] {
			activeCables = append(activeCables, cable)
		}
	}
	cables = activeCables

	// 3. FIX N+1 QUERY: Hitung semua koneksi kabel per node dalam 1 query
	type NodeCount struct {
		NodeID int `gorm:"column:node_id"`
		Count  int `gorm:"column:count"`
	}
	var counts []NodeCount
	config.DB.Raw(`
		SELECT node_id, COUNT(*) as count FROM (
			SELECT source_node_id as node_id FROM network_cables
			UNION ALL
			SELECT target_node_id as node_id FROM network_cables
		) t GROUP BY node_id
	`).Scan(&counts)

	// Buat map untuk O(1) lookup
	countMap := make(map[int]int)
	for _, c := range counts {
		countMap[c.NodeID] = c.Count
	}

	// Apply ke nodes (memory only, tidak save ke DB)
	for i := range nodes {
		if nodes[i].Type == models.TypeODP && nodes[i].ODPDetail != nil {
			nodes[i].ODPDetail.UsedPorts = countMap[nodes[i].NodeID]
		}
	}

	return utils.Success(c, "Data topology loaded", map[string]interface{}{
		"nodes":  nodes,
		"cables": cables,
	})
}

// ==========================================
// GET TOPOLOGY TABLE (untuk halaman tabel)
// ==========================================

type NodeTableRow struct {
	NodeID         int     `json:"node_id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Lat            float64 `json:"lat"`
	Lng            float64 `json:"lng"`
	Description    string  `json:"description"`
	Status         string  `json:"status"`
	TotalPorts     int     `json:"total_ports,omitempty"`
	UsedPorts      int     `json:"used_ports,omitempty"`
	Brand          string  `json:"brand,omitempty"`
	UplinkType     string  `json:"uplink_type,omitempty"`
	IPAddress      string  `json:"ip_address,omitempty"`
	Capacity       int     `json:"capacity,omitempty"`
	SubscriberID   string  `json:"subscriber_id,omitempty"`
	PacketName     string  `json:"packet_name,omitempty"`
	LinkedRouterID string  `json:"linked_router_id,omitempty"`
	CableCount     int     `json:"cable_count"`
}

type CableTableRow struct {
	CableID      int     `json:"cable_id"`
	SourceName   string  `json:"source_name"`
	TargetName   string  `json:"target_name"`
	CableType    string  `json:"cable_type"`
	Description  string  `json:"description"`
	LengthMeter  float64 `json:"length_meter"`
}

func GetTopologyTable(c *fiber.Ctx) error {
	// --- NODES ---
	var nodes []models.NetworkNode
	if err := config.DB.
		Preload("ODPDetail").
		Preload("OLTDetail").
		Preload("ODCDetail").
		Preload("ClientDetail").
		Find(&nodes).Error; err != nil {
		return utils.Failed(c, err.Error())
	}

	// Hitung cable count per node
	type NodeCount struct {
		NodeID int `gorm:"column:node_id"`
		Count  int `gorm:"column:count"`
	}
	var counts []NodeCount
	config.DB.Raw(`
		SELECT node_id, COUNT(*) as count FROM (
			SELECT source_node_id as node_id FROM network_cables
			UNION ALL
			SELECT target_node_id as node_id FROM network_cables
		) t GROUP BY node_id
	`).Scan(&counts)
	countMap := make(map[int]int)
	for _, cnt := range counts {
		countMap[cnt.NodeID] = cnt.Count
	}

	nodeRows := make([]NodeTableRow, 0, len(nodes))
	for _, n := range nodes {
		row := NodeTableRow{
			NodeID:      n.NodeID,
			Name:        n.Name,
			Type:        string(n.Type),
			Lat:         n.Latitude,
			Lng:         n.Longitude,
			Description: n.Description,
			Status:      n.Status,
			CableCount:  countMap[n.NodeID],
		}
		if n.ODPDetail != nil {
			row.TotalPorts = n.ODPDetail.TotalPorts
			row.UsedPorts = countMap[n.NodeID]
		}
		if n.OLTDetail != nil {
			row.Brand = n.OLTDetail.Brand
			row.UplinkType = n.OLTDetail.UplinkType
			row.IPAddress = n.OLTDetail.IPAddress
		}
		if n.ODCDetail != nil {
			row.Capacity = n.ODCDetail.Capacity
		}
		if n.ClientDetail != nil {
			row.SubscriberID = n.ClientDetail.SubscriberID
			row.PacketName = n.ClientDetail.PacketName
		}
		if n.LinkedRouterID != nil {
			row.LinkedRouterID = n.LinkedRouterID.String()
		}
		nodeRows = append(nodeRows, row)
	}

	// --- CABLES ---
	var cables []models.NetworkCable
	if err := config.DB.Preload("SourceNode").Preload("TargetNode").Find(&cables).Error; err != nil {
		return utils.Failed(c, err.Error())
	}

	cableRows := make([]CableTableRow, 0, len(cables))
	for _, cab := range cables {
		cableRows = append(cableRows, CableTableRow{
			CableID:     cab.CableID,
			SourceName:  cab.SourceNode.Name,
			TargetName:  cab.TargetNode.Name,
			CableType:   cab.CableType,
			Description: cab.Description,
			LengthMeter: cab.LengthMeter,
		})
	}

	return utils.Success(c, "Table data loaded", map[string]interface{}{
		"nodes":  nodeRows,
		"cables": cableRows,
		"summary": map[string]interface{}{
			"total_nodes":   len(nodeRows),
			"total_cables":  len(cableRows),
		},
	})
}

// ==========================================
// ADD NODE
// ==========================================

func AddNetworkNode(c *fiber.Ctx) error {
	type AddNodeRequest struct {
		models.NetworkNode
		TotalPorts     int     `json:"total_ports"`
		Brand          string  `json:"brand"`
		UplinkType     string  `json:"uplink_type"`
		IPAddress      string  `json:"ip_address"`
		Capacity       int     `json:"capacity"`
		SubscriberID   string  `json:"subscriber_id"`
		PacketName     string  `json:"packet_name"`
		LinkedRouterID *string `json:"linked_router_id"`
	}

	var req AddNodeRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	if req.Latitude == 0 || req.Longitude == 0 {
		return utils.Failed(c, "Koordinat wajib diisi")
	}

	// Auto-correct coordinates if swapped (latitude must be between -90 and 90)
	if req.Latitude < -90 || req.Latitude > 90 {
		if req.Longitude >= -90 && req.Longitude <= 90 {
			req.Latitude, req.Longitude = req.Longitude, req.Latitude
		}
	}

	if req.Name == "" {
		return utils.Failed(c, "Nama node wajib diisi")
	}

	err := config.DB.Transaction(func(tx *gorm.DB) error {
		node := req.NetworkNode

		// Parse LinkedRouterID if passed
		if req.LinkedRouterID != nil && *req.LinkedRouterID != "" {
			parsedUUID, err := uuid.Parse(*req.LinkedRouterID)
			if err != nil {
				return fmt.Errorf("invalid router UUID format")
			}
			node.LinkedRouterID = &parsedUUID
		}

		if err := tx.Create(&node).Error; err != nil {
			return err
		}

		switch node.Type {
		case models.TypeODP:
			ports := 8
			if req.TotalPorts > 0 {
				ports = req.TotalPorts
			}
			odp := models.ODP{NodeID: node.NodeID, TotalPorts: ports, UsedPorts: 0}
			if err := tx.Create(&odp).Error; err != nil {
				return err
			}

		case models.TypeOLT:
			olt := models.OLT{
				NodeID:     node.NodeID,
				Brand:      req.Brand,
				UplinkType: req.UplinkType,
				IPAddress:  req.IPAddress,
			}
			if err := tx.Create(&olt).Error; err != nil {
				return err
			}

		case models.TypeODC:
			capacity := 144
			if req.Capacity > 0 {
				capacity = req.Capacity
			}
			odc := models.ODC{NodeID: node.NodeID, Capacity: capacity}
			if err := tx.Create(&odc).Error; err != nil {
				return err
			}

		case models.TypeClient:
			// 1. Tentukan apakah menggunakan pelanggan CRM yang sudah ada atau buat baru secara otomatis
			var crmClientID int
			var existingClient models.Client
			
			useExisting := false
			if req.SubscriberID != "" {
				if parsedID, err := strconv.Atoi(req.SubscriberID); err == nil {
					if err := tx.First(&existingClient, parsedID).Error; err == nil {
						useExisting = true
						crmClientID = existingClient.ClientID
						
						// Sinkronkan koordinat & router ke pelanggan CRM yang sudah ada
						existingClient.Latitude = node.Latitude
						existingClient.Longitude = node.Longitude
						if node.Description != "" {
							existingClient.Address = node.Description
						}
						if node.LinkedRouterID != nil {
							existingClient.RouterID = node.LinkedRouterID.String()
						}
						tx.Save(&existingClient)
					}
				}
			}

			if !useExisting {
				// Buat pelanggan CRM baru secara otomatis
				crmClient := models.Client{
					Name:      node.Name,
					Address:   node.Description,
					Latitude:  node.Latitude,
					Longitude: node.Longitude,
				}

				// Cari paket internet yang sesuai
				if req.PacketName != "" {
					var pkg models.Internetpackage
					if err := tx.Where("package_name = ? AND is_deleted = 0", req.PacketName).First(&pkg).Error; err == nil {
						crmClient.PackageID = &pkg.PackageID
					}
				}

				// Cari penampung router jika diset
				if node.LinkedRouterID != nil {
					crmClient.RouterID = node.LinkedRouterID.String()
				}

				if err := tx.Create(&crmClient).Error; err != nil {
					return err
				}
				crmClientID = crmClient.ClientID
			}

			// 2. Buat ClientNode dengan link ID pelanggan CRM yang valid (menjamin inner join di topologi sukses)
			clientNode := models.ClientNode{
				NodeID:       node.NodeID,
				SubscriberID: strconv.Itoa(crmClientID),
				PacketName:   req.PacketName,
			}
			if err := tx.Create(&clientNode).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return utils.Failed(c, "Gagal membuat node: "+err.Error())
	}
	return utils.Success(c, "Node berhasil dibuat", nil)
}

// ==========================================
// UPDATE NODE (posisi / info dasar)
// ==========================================

func UpdateNetworkNode(c *fiber.Ctx) error {
	id := c.Params("id")
	var input models.NetworkNode

	if err := c.BodyParser(&input); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	// Auto-correct coordinates if swapped (latitude must be between -90 and 90)
	if input.Latitude < -90 || input.Latitude > 90 {
		if input.Longitude >= -90 && input.Longitude <= 90 {
			input.Latitude, input.Longitude = input.Longitude, input.Latitude
		}
	}

	var node models.NetworkNode
	if err := config.DB.First(&node, id).Error; err != nil {
		return utils.Failed(c, "Node not found")
	}

	node.Name = input.Name
	node.Description = input.Description
	node.Latitude = input.Latitude
	node.Longitude = input.Longitude
	node.Status = input.Status

	if err := config.DB.Save(&node).Error; err != nil {
		return utils.Failed(c, "Gagal update node")
	}
	return utils.Success(c, "Node updated", node)
}

// ==========================================
// DELETE NODE (cascade delete cables)
// ==========================================

func DeleteNetworkNode(c *fiber.Ctx) error {
	id := c.Params("id")

	var node models.NetworkNode
	if err := config.DB.First(&node, id).Error; err != nil {
		return utils.Failed(c, "Node tidak ditemukan")
	}

	err := config.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Hapus semua kabel yang terhubung ke node ini (sebagai source ATAU target)
		if err := tx.Where("source_node_id = ? OR target_node_id = ?", node.NodeID, node.NodeID).
			Delete(&models.NetworkCable{}).Error; err != nil {
			return err
		}

		// 2. Hapus detail aset spesifik berdasarkan tipe
		switch node.Type {
		case models.TypeODP:
			tx.Where("node_id = ?", node.NodeID).Delete(&models.ODP{})
		case models.TypeOLT:
			tx.Where("node_id = ?", node.NodeID).Delete(&models.OLT{})
		case models.TypeODC:
			tx.Where("node_id = ?", node.NodeID).Delete(&models.ODC{})
		case models.TypeClient:
			tx.Where("node_id = ?", node.NodeID).Delete(&models.ClientNode{})
		}

		// 3. Hapus node utama
		if err := tx.Delete(&node).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return utils.Failed(c, "Gagal menghapus node: "+err.Error())
	}
	return utils.Success(c, "Node dan kabel terkait berhasil dihapus", nil)
}

// ==========================================
// ADD CABLE
// ==========================================

func AddNetworkCable(c *fiber.Ctx) error {
	var cable models.NetworkCable
	if err := c.BodyParser(&cable); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	if cable.SourceNodeID == cable.TargetNodeID {
		return utils.Failed(c, "Source dan Target tidak boleh sama")
	}
	if cable.SourceNodeID == 0 || cable.TargetNodeID == 0 {
		return utils.Failed(c, "Source dan Target node wajib diisi")
	}

	if err := config.DB.Create(&cable).Error; err != nil {
		return utils.Failed(c, err.Error())
	}
	return utils.Success(c, "Kabel berhasil ditambahkan", cable)
}

// ==========================================
// DELETE CABLE
// ==========================================

func DeleteNetworkCable(c *fiber.Ctx) error {
	id := c.Params("id")

	var cable models.NetworkCable
	if err := config.DB.First(&cable, id).Error; err != nil {
		return utils.Failed(c, "Kabel tidak ditemukan")
	}

	if err := config.DB.Delete(&cable).Error; err != nil {
		return utils.Failed(c, "Gagal menghapus kabel")
	}
	return utils.Success(c, "Kabel berhasil dihapus", nil)
}

// ==========================================
// UPDATE CABLE PATH
// ==========================================

func UpdateCablePath(c *fiber.Ctx) error {
	id := c.Params("id")

	type UpdatePathRequest struct {
		Coordinates string  `json:"coordinates"`
		Length      float64 `json:"length_meter"`
	}

	var req UpdatePathRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	var cable models.NetworkCable
	if err := config.DB.First(&cable, id).Error; err != nil {
		return utils.Failed(c, "Kabel tidak ditemukan")
	}

	cable.Coordinates = req.Coordinates
	cable.LengthMeter = req.Length
	config.DB.Save(&cable)

	return utils.Success(c, "Jalur kabel berhasil disimpan", cable)
}

// ==========================================
// UPDATE CABLE DETAILS (cable_type & description)
// ==========================================

func UpdateCableDetails(c *fiber.Ctx) error {
	id := c.Params("id")

	type UpdateDetailsReq struct {
		CableType   string `json:"cable_type"`
		Description string `json:"description"`
	}

	var req UpdateDetailsReq
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	var cable models.NetworkCable
	if err := config.DB.First(&cable, id).Error; err != nil {
		return utils.Failed(c, "Kabel tidak ditemukan")
	}

	cable.CableType = req.CableType
	cable.Description = req.Description
	
	if err := config.DB.Save(&cable).Error; err != nil {
		return utils.Failed(c, "Gagal mengupdate kabel")
	}

	return utils.Success(c, "Detail kabel berhasil disimpan", cable)
}

// ==========================================
// UPDATE NODE DETAILS (ODP ports, OLT brand, dll)
// ==========================================

func UpdateNodeDetails(c *fiber.Ctx) error {
	id := c.Params("id")

	type UpdateDetailReq struct {
		Type           string  `json:"type"`
		TotalPorts     int     `json:"total_ports"`
		UsedPorts      int     `json:"used_ports"`
		Brand          string  `json:"brand"`
		UplinkType     string  `json:"uplink_type"`
		IPAddress      string  `json:"ip_address"`
		Capacity       int     `json:"capacity"`
		SubscriberID   string  `json:"subscriber_id"`
		PacketName     string  `json:"packet_name"`
		OnuSN          string  `json:"onu_sn"`
		PppoeUsername  string  `json:"pppoe_username"`
		LinkedRouterID *string `json:"linked_router_id"`
	}

	var req UpdateDetailReq
	if err := c.BodyParser(&req); err != nil {
		return utils.Failed(c, "Invalid body")
	}

	var node models.NetworkNode
	if err := config.DB.First(&node, id).Error; err != nil {
		return utils.Failed(c, "Node not found")
	}

	err := config.DB.Transaction(func(tx *gorm.DB) error {
		switch req.Type {
		case "ODP":
			var odp models.ODP
			tx.Where("node_id = ?", node.NodeID).First(&odp)
			odp.NodeID = node.NodeID
			odp.TotalPorts = req.TotalPorts
			odp.UsedPorts = req.UsedPorts
			if err := tx.Save(&odp).Error; err != nil {
				return err
			}
		case "OLT":
			var olt models.OLT
			tx.Where("node_id = ?", node.NodeID).First(&olt)
			olt.NodeID = node.NodeID
			olt.Brand = req.Brand
			olt.UplinkType = req.UplinkType
			olt.IPAddress = req.IPAddress
			if err := tx.Save(&olt).Error; err != nil {
				return err
			}
		case "ODC":
			var odc models.ODC
			tx.Where("node_id = ?", node.NodeID).First(&odc)
			odc.NodeID = node.NodeID
			odc.Capacity = req.Capacity
			if err := tx.Save(&odc).Error; err != nil {
				return err
			}
		case "CLIENT":
			var client models.ClientNode
			tx.Where("node_id = ?", node.NodeID).First(&client)
			client.NodeID = node.NodeID
			client.SubscriberID = req.SubscriberID
			client.PacketName = req.PacketName
			client.IPAddress = req.IPAddress
			client.OnuSN = req.OnuSN
			client.PppoeUsername = req.PppoeUsername
			if err := tx.Save(&client).Error; err != nil {
				return err
			}

			// Sync back to clients CRM table if possible
			clientID, err := strconv.Atoi(req.SubscriberID)
			if err == nil {
				tx.Model(&models.Client{}).Where("client_id = ?", clientID).Updates(map[string]interface{}{
					"ip_address":     req.IPAddress,
					"onu_sn":         req.OnuSN,
					"pppoe_username": req.PppoeUsername,
				})
			}
		case "ROUTER":
			if req.LinkedRouterID != nil && *req.LinkedRouterID != "" {
				parsedUUID, err := uuid.Parse(*req.LinkedRouterID)
				if err != nil {
					return fmt.Errorf("invalid router UUID format")
				}
				node.LinkedRouterID = &parsedUUID
			} else {
				node.LinkedRouterID = nil
			}
			if err := tx.Save(&node).Error; err != nil {
				return err
			}
		default:
			return fmt.Errorf("tipe node '%s' tidak mendukung edit detail", req.Type)
		}
		return nil
	})

	if err != nil {
		return utils.Failed(c, "Gagal mengupdate detail: "+err.Error())
	}

	return utils.Success(c, "Detail aset berhasil diupdate", nil)
}
