package models

import (
	"github.com/google/uuid"
)

// Jenis Node: Tambahkan ROUTER dan TB
type NodeType string

const (
	TypeOLT    NodeType = "OLT"
	TypeODC    NodeType = "ODC"
	TypeODP    NodeType = "ODP"
	TypeTB     NodeType = "TB"     // Terminal Box (Baru)
	TypeRouter NodeType = "ROUTER" // Perangkat Router (Baru)
	TypeClient NodeType = "CLIENT"
)

type NetworkNode struct {
	NodeID int      `gorm:"primaryKey;autoIncrement" json:"node_id"`
	Name   string   `gorm:"type:varchar(100)" json:"name"`
	Type   NodeType `gorm:"type:varchar(20)" json:"type"`

	// Koordinat (Input manual atau dari map)
	Latitude  float64 `gorm:"type:decimal(10,8)" json:"lat"`
	Longitude float64 `gorm:"type:decimal(11,8)" json:"lng"`

	Description string `gorm:"type:text" json:"description"`
	Status      string `gorm:"default:'ONLINE'" json:"status"`
	// --- RELASI KE TABEL ASET ---
	ODPDetail    *ODP        `gorm:"foreignKey:NodeID;references:NodeID" json:"odp_detail,omitempty"`
	OLTDetail    *OLT        `gorm:"foreignKey:NodeID;references:NodeID" json:"olt_detail,omitempty"`
	ODCDetail    *ODC        `gorm:"foreignKey:NodeID;references:NodeID" json:"odc_detail,omitempty"`
	ClientDetail *ClientNode `gorm:"foreignKey:NodeID;references:NodeID" json:"client_detail,omitempty"`

	// --- Helper Field untuk Hitung Kabel ---
	CablesOut []NetworkCable `gorm:"foreignKey:SourceNodeID" json:"-"`
	// [OPSIONAL] Jika Node ini adalah Router Mikrotik yang terdaftar di tabel 'routers'
	// Kita bisa simpan ID-nya untuk link ke dashboard router
	LinkedRouterID *uuid.UUID `gorm:"type:char(36)" json:"linked_router_id,omitempty"`

	// Relasi ke tabel Routers (jika ada)
	RouterInfo *Router `gorm:"foreignKey:LinkedRouterID;references:RouterID" json:"router_info,omitempty"`
}

type NetworkCable struct {
	CableID      int     `gorm:"primaryKey;autoIncrement" json:"cable_id"`
	SourceNodeID int     `json:"source_node_id"`
	TargetNodeID int     `json:"target_node_id"`
	CableType    string  `json:"cable_type"`
	Description  string  `json:"description"`
	LengthMeter  float64 `json:"length_meter"`
	Coordinates  string  `gorm:"type:text" json:"coordinates"`

	SourceNode NetworkNode `gorm:"foreignKey:SourceNodeID;references:NodeID" json:"source_node"`
	TargetNode NetworkNode `gorm:"foreignKey:TargetNodeID;references:NodeID" json:"target_node"`
}
