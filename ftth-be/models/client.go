package models

import (
	"time"

	"gorm.io/gorm"
)

type Client struct {
	ClientID   int            `gorm:"primaryKey;autoIncrement;column:client_id" json:"client_id"`
	Name       string         `gorm:"type:varchar(100);not null;column:name" json:"name"`
	Phone      string         `gorm:"type:varchar(20);column:phone" json:"phone"`
	Address    string         `gorm:"type:text;column:address" json:"address"`
	HousePhoto string         `gorm:"type:varchar(255);column:house_photo" json:"house_photo"`
	RouterID   string         `gorm:"type:char(36);column:router_id" json:"router_id"`
	Fat        string         `gorm:"type:varchar(55);column:fat" json:"fat"` // Area FAT (Fiber Access Terminal / ODP)
	PackageID  *int           `gorm:"column:package_id" json:"package_id,omitempty"` // Paket Internet
	Latitude      float64        `gorm:"type:double;column:latitude" json:"latitude"`
	Longitude     float64        `gorm:"type:double;column:longitude" json:"longitude"`
	IPAddress     string         `gorm:"type:varchar(50);column:ip_address" json:"ip_address"`
	IPPoolID      *int           `gorm:"column:ip_pool_id" json:"ip_pool_id,omitempty"`
	OnuSN         string         `gorm:"type:varchar(50);column:onu_sn" json:"onu_sn"`
	PppoeUsername string         `gorm:"type:varchar(50);column:pppoe_username" json:"pppoe_username"`
	PppoePassword string         `gorm:"type:varchar(100);column:pppoe_password" json:"pppoe_password"`
	PppoeProfile  string         `gorm:"type:varchar(100);column:pppoe_profile" json:"pppoe_profile"`
	RxPower       string         `gorm:"type:varchar(20);column:rx_power" json:"rx_power"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index;column:deleted_at" json:"deleted_at,omitempty"` // Soft delete

	// Relasi
	Router          *Router          `gorm:"foreignKey:RouterID;references:RouterID" json:"router,omitempty"`
	InternetPackage *Internetpackage `gorm:"foreignKey:PackageID;references:PackageID" json:"internet_package,omitempty"`
}
