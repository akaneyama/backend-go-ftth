package main

import (
	"akane/be-ftth/config"
	"akane/be-ftth/migrations"
	"akane/be-ftth/routes"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	config.ConnectDB()
	// config.DB.AutoMigrate(&models.User{})
	migrations.RunMigrations()

	app := fiber.New()
	routes.UserRoutes(app)

	app.Listen(":8080")
}
