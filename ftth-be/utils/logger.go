package utils

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"fmt"
	"time"
)

func CreateLog(executor string, logType string, status string, description string) {
	go func() {
		logEntry := models.Log{
			Executor:       executor,
			LogType:        logType,
			LogStatus:      status,
			LogDescription: description,
			CreatedAt:      time.Now(),
		}

		if err := config.DB.Create(&logEntry).Error; err != nil {
			fmt.Printf("[LOG ERROR] Failed: %v\n", err)
		}
	}()
}
