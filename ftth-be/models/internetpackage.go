package models

import (
	"time"
)

type Internetpackage struct {
	PackageID    int       `gorm:"type:int;primaryKey;autoIncrement" json:"package_id"`
	PackageName  string    `gorm:"type:varchar(200)" json:"package_name"`
	PackageLimit string    `gorm:"type:varchar(100)" json:"package_limit"` // 10/10 (upload / download)
	PackagePrice int       `gorm:"type:int" json:"package_price"`
	PackageDesc  string    `gorm:"type:varchar(255)" json:"package_desc"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	IsDeleted    int       `gorm:"default:0" json:"is_deleted"`
}
