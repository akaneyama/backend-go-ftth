package models

// 1. Tabel Detail ODP (Capacity Planning)
type ODP struct {
	ODPID      int `gorm:"primaryKey;autoIncrement" json:"odp_id"`
	NodeID     int `gorm:"unique;not null" json:"node_id"` // Link ke NetworkNode
	TotalPorts int `gorm:"default:8" json:"total_ports"`   // Kapasitas (8, 16, 24)
	UsedPorts  int `gorm:"default:0" json:"used_ports"`    // Terisi berapa (Dihitung dari kabel)

	// Relasi
	Node NetworkNode `gorm:"foreignKey:NodeID;references:NodeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
}

// 2. Tabel Detail OLT
type OLT struct {
	OLTID      int    `gorm:"primaryKey;autoIncrement" json:"olt_id"`
	NodeID     int    `gorm:"unique;not null" json:"node_id"`
	Brand      string `gorm:"type:varchar(50)" json:"brand"`       // ZTE, Huawei, Hioso
	UplinkType string `gorm:"type:varchar(20)" json:"uplink_type"` // 1G, 10G
	IPAddress  string `gorm:"type:varchar(20)" json:"ip_address"`

	Node NetworkNode `gorm:"foreignKey:NodeID;references:NodeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
}

// 3. Tabel Detail ODC
type ODC struct {
	ODCID    int `gorm:"primaryKey;autoIncrement" json:"odc_id"`
	NodeID   int `gorm:"unique;not null" json:"node_id"`
	Capacity int `gorm:"default:144" json:"capacity"` // 48, 96, 144, 288 core

	Node NetworkNode `gorm:"foreignKey:NodeID;references:NodeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
}

// 4. Tabel Detail Client (Rumah)
type ClientNode struct {
	ClientID     int    `gorm:"primaryKey;autoIncrement" json:"client_id"`
	NodeID       int    `gorm:"unique;not null" json:"node_id"`
	SubscriberID string `gorm:"type:varchar(50)" json:"subscriber_id"` // ID Pelanggan / PPPoE User
	PacketName   string `gorm:"type:varchar(50)" json:"packet_name"`

	Node NetworkNode `gorm:"foreignKey:NodeID;references:NodeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
}
