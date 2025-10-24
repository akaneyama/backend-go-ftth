package models

import "time"

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Email     string    `gorm:"unique;not null" json:"email"`
	Fullname  string    `json:"fullname"`
	Password  string    `json:"password,omitempty"`
	Role      int       `gorm:"default:3" json:"role"` // 1=Admin, 2=Teknisi, 3=User
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
