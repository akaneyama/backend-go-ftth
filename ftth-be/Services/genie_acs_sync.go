package services

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"
	"log"
	"os"
)

func RunGenieACSSyncJob() {
	urlAcs := os.Getenv("GENIE_ACS_URL")
	if urlAcs == "" {
		log.Println("[CRON] GenieACS URL not configured, skipping sync.")
		return
	}

	devices, err := utils.GetAllDevices(urlAcs)
	if err != nil {
		log.Printf("[CRON] Failed to fetch GenieACS devices: %v", err)
		return
	}

	var clients []models.Client
	if err := config.DB.Find(&clients).Error; err != nil {
		log.Printf("[CRON] Failed to get clients from DB: %v", err)
		return
	}

	for _, client := range clients {
		for _, dev := range devices {
			// Cocokkan berdasarkan IP, SN, atau PPPoE
			if (dev.IPAddress != "" && dev.IPAddress != "0.0.0.0" && dev.IPAddress == client.IPAddress) || 
			   (dev.DeviceSN != "" && dev.DeviceSN == client.OnuSN) ||
			   (client.PppoeUsername != "" && (dev.IPAddress == client.PppoeUsername)) {
				
				if client.RxPower != dev.RXPower {
					client.RxPower = dev.RXPower
					config.DB.Save(&client)
					log.Printf("[CRON] Updated RxPower for client %s to %s", client.Name, dev.RXPower)
				}
				break
			}
		}
	}

	// Simpan riwayat history untuk setiap perangkat yang memiliki SNR valid
	for _, dev := range devices {
		if dev.DeviceSN != "" && dev.RXPower != "" {
			var parsedRxPower float64
			fmt.Sscanf(dev.RXPower, "%f", &parsedRxPower)
			
			// Jika sinyal bukan 0 atau kosong, simpan
			if parsedRxPower != 0 {
				history := models.RxPowerHistory{
					DeviceSN: dev.DeviceSN,
					RxPower:  parsedRxPower,
				}
				config.DB.Create(&history)
			}
		}
	}

	log.Println("[CRON] GenieACS Sync Job Completed.")
}
