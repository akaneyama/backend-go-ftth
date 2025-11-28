package models

import (
	"time"
)

type Log struct {
	LogID          int       `gorm:"type:int;primaryKey;autoIncrement" json:"log_id"`
	Executor       string    `gorm:"type:varchar(120)" json:"executor"`
	LogType        string    `gorm:"type:varchar(120)" json:"log_type"`
	LogStatus      string    `gorm:"type:varchar(120)" json:"log_status"`
	LogDescription string    `gorm:"type:varchar(255)" json:"log_description"`
	CreatedAt      time.Time `json:"created_at"`
}
