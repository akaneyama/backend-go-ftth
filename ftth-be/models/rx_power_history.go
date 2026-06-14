package models

import (
	"time"
)

type RxPowerHistory struct {
	HistoryID  int       `gorm:"primaryKey;autoIncrement;column:history_id" json:"history_id"`
	DeviceSN   string    `gorm:"type:varchar(100);index;column:device_sn" json:"device_sn"`
	RxPower    float64   `gorm:"type:double;column:rx_power" json:"rx_power"`
	RecordedAt time.Time `gorm:"column:recorded_at;autoCreateTime" json:"recorded_at"`
}
