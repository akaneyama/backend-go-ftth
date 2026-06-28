package models

import (
	"time"

	"gorm.io/gorm"
)

type IPPool struct {
	ID        int            `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name      string         `gorm:"type:varchar(100);not null;column:name" json:"name"`
	Subnet    string         `gorm:"type:varchar(50);not null;column:subnet" json:"subnet"`   // e.g. 192.168.10.0/24
	Gateway   string         `gorm:"type:varchar(50);not null;column:gateway" json:"gateway"` // e.g. 192.168.10.1
	RouterID  *string        `gorm:"type:char(36);column:router_id" json:"router_id,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index;column:deleted_at" json:"deleted_at,omitempty"` // Soft delete

	// Relasi
	Router *Router `gorm:"foreignKey:RouterID;references:RouterID" json:"router,omitempty"`
}
