package models

import (
	"time"
)

type TopologyMapping struct {
	MappingID int       `gorm:"primaryKey;autoIncrement" json:"mapping_id"`
	RouterID  string    `gorm:"type:char(36);not null" json:"router_id"` // ID Mikrotik dari tabel 'routers'
	OLTNodeID int       `gorm:"not null" json:"olt_node_id"`             // ID Node OLT dari network_nodes
	ODCNodeID int       `gorm:"not null" json:"odc_node_id"`             // ID Node ODC dari network_nodes
	ODPNodeID int       `gorm:"not null;unique" json:"odp_node_id"`      // ID Node ODP/FAT dari network_nodes (Unique: 1 ODP/FAT punya 1 jalur ke atas)
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relasi untuk Preload
	Router  *Router      `gorm:"foreignKey:RouterID;references:RouterID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"router,omitempty"`
	OLTNode *NetworkNode `gorm:"foreignKey:OLTNodeID;references:NodeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"olt_node,omitempty"`
	ODCNode *NetworkNode `gorm:"foreignKey:ODCNodeID;references:NodeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"odc_node,omitempty"`
	ODPNode *NetworkNode `gorm:"foreignKey:ODPNodeID;references:NodeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"odp_node,omitempty"`
}
