package models

// Jenis Node: OLT, ODC, ODP, CLIENT
type NodeType string

const (
	TypeOLT    NodeType = "OLT"
	TypeODC    NodeType = "ODC"
	TypeODP    NodeType = "ODP"
	TypeClient NodeType = "CLIENT"
)

type NetworkNode struct {
	NodeID      int      `gorm:"primaryKey;autoIncrement" json:"node_id"`
	Name        string   `gorm:"type:varchar(100)" json:"name"`
	Type        NodeType `gorm:"type:varchar(20)" json:"type"` // OLT, ODC, etc.
	Latitude    float64  `gorm:"type:decimal(10,8)" json:"lat"`
	Longitude   float64  `gorm:"type:decimal(11,8)" json:"lng"`
	Description string   `gorm:"type:text" json:"description"`
	Status      string   `gorm:"default:'ONLINE'" json:"status"` // ONLINE, OFFLINE, ALARM (Bisa diupdate via SNMP)

	// Relasi (Opsional untuk query complex)
	// CablesFrom []NetworkCable `gorm:"foreignKey:SourceNodeID"`
	// CablesTo   []NetworkCable `gorm:"foreignKey:TargetNodeID"`
}

type NetworkCable struct {
	CableID      int `gorm:"primaryKey;autoIncrement" json:"cable_id"`
	SourceNodeID int `json:"source_node_id"` // Dari mana (misal OLT)
	TargetNodeID int `json:"target_node_id"` // Ke mana (misal ODC)

	// Detail Kabel
	CableType   string  `json:"cable_type"`   // e.g., "ADSS 24 Core", "Dropcore 1 Core"
	CoreColor   string  `json:"core_color"`   // e.g., "Blue/Orange"
	LengthMeter float64 `json:"length_meter"` // Estimasi jarak
	Description string  `json:"description"`  // Penjelasan kabel

	Coordinates string `gorm:"type:text" json:"coordinates"`
	// Relasi
	SourceNode NetworkNode `gorm:"foreignKey:SourceNodeID;references:NodeID" json:"source_node"`
	TargetNode NetworkNode `gorm:"foreignKey:TargetNodeID;references:NodeID" json:"target_node"`
}
