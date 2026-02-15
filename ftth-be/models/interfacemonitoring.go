package models

import (
	"time"

	"github.com/google/uuid"
)

type InterfaceMonitoring struct {
	InterfaceID int `gorm:"primaryKey;autoIncrement" json:"interface_id"`

	InterfaceName string    `gorm:"type:varchar(120);not null" json:"interface_name"`
	RouterID      uuid.UUID `gorm:"type:char(36);not null" json:"router_id"`

	Router     Router    `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:RouterID;references:RouterID"`
	IsExcluded int       `gorm:"default:0" json:"is_excluded"` // 0=Monitor, 1=Exclude/Ignore
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	IsDeleted  int       `gorm:"default:0" json:"is_deleted"`

	Traffic []InterfaceTraffic `gorm:"foreignKey:InterfaceID;references:InterfaceID"`
}
