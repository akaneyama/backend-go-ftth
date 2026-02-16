package main

import (
	services "akane/be-ftth/Services" // Pastikan import path sesuai
	"akane/be-ftth/config"
	"akane/be-ftth/migrations"
	"akane/be-ftth/routes"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	config.ConnectDB()
	migrations.RunMigrations()

	// --- SETUP CRON JOBS ---
	c := cron.New()

	// JOB 1: Traffic Sync (Setiap Jam atau bisa diganti @every 5m)
	_, errT := c.AddFunc("@hourly", func() {
		log.Println("[CRON] Running Traffic Sync...")
		services.RunTrafficSyncJob()
	})
	if errT != nil {
		log.Fatal(errT)
	}

	// JOB 2: Ping Check (Setiap 30 Menit)
	// Format: "@every 30m"
	_, errP := c.AddFunc("@every 30m", func() {
		log.Println("[CRON] Running Ping Check...")
		services.RunPingCheckJob()
	})
	if errP != nil {
		log.Fatal(errP)
	}

	c.Start()
	defer c.Stop()
	// -----------------------

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		  AllowOrigins: "http://localhost, http://192.168.5.205",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS,PATCH",
		AllowCredentials: true,
	}))

	routes.UserRoutes(app)
	routes.RouterRoutes(app)
	routes.InterfaceMonitoringRoutes(app)
	routes.InterfaceTrafficRoutes(app)
	routes.InternetPackageRoutes(app)
	routes.ConfigurationRoutes(app)
	routes.TopologyRoutes(app)

	log.Fatal(app.Listen(":8080"))
}
