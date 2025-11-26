package main

import (
 "akane/be-ftth/Services"
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
	// config.DB.AutoMigrate(&models.User{})
	migrations.RunMigrations()
	c := cron.New()

	// Format Cron: "0 * * * *" artinya menit ke-0 setiap jam (Setiap 1 Jam)
	// Atau pakai preset "@hourly"
	_, err2 := c.AddFunc("@hourly", func() {
		log.Println("Running Hourly Traffic Sync...")
		services.RunTrafficSyncJob()
	})
	if err2 != nil {
		log.Fatal("Gagal menjalankan cron:", err2)
	}

	c.Start()
	// Jangan lupa stop cron saat app mati (opsional di main sederhana)
	defer c.Stop()
	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000, http://127.0.0.1:5173,http://localhost:5173",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowCredentials: true,
	}))
	routes.UserRoutes(app)
	routes.RouterRoutes(app)
	routes.InterfaceMonitoringRoutes(app)
	routes.InterfaceTrafficRoutes(app)

	app.Listen(":8080")
}
