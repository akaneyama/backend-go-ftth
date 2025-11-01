package models

import "time"

type InterfaceTraffic struct {
	TrafficID int `gorm:"primaryKey;autoIncrement" json:"traffic_id"`

	// Pastikan ini juga 'int' agar konsisten
	InterfaceID int `gorm:"not null" json:"interface_id"`

	DownloadSpeed float64
	UploadSpeed   float64
	Timestamp     time.Time `gorm:"autoCreateTime" json:"timestamp"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	IsDeleted     int       `gorm:"default:0" json:"is_deleted"`

	Interface InterfaceMonitoring `gorm:"foreignKey:InterfaceID;references:InterfaceID"`
}
