package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Router struct {
	RouterID         uuid.UUID `gorm:"type:char(36);primaryKey" json:"router_id"`
	RouterName       string    `gorm:"type:varchar(120)" json:"router_name"`
	RouterAddress    string    `gorm:"type:varchar(120)" json:"router_address"`
	RouterPort       int       `gorm:"type:int" json:"router_port"`
	RouterStatus     string    `gorm:"type:varchar(120)" json:"router_status"`
	RouterType       string    `gorm:"type:varchar(120)" json:"router_type"`
	RouterRemoteType string    `gorm:"type:varchar(120)" json:"router_remote_type"`
	RouterUsername   string    `gorm:"type:varchar(120)" json:"router_username"`
	RouterPassword   string    `json:"router_password,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	IsDeleted        int       `gorm:"default:0" json:"is_deleted"`

	Interfaces []InterfaceMonitoring `gorm:"foreignKey:RouterID;references:RouterID"`
}

func (r *Router) BeforeCreate(tx *gorm.DB) (err error) {
	if r.RouterID == uuid.Nil {
		r.RouterID = uuid.New()
	}
	return
}
