package main

import (
	"akane/be-ftth/config"
	"akane/be-ftth/migrations"
	"akane/be-ftth/routes"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
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
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000, http://127.0.0.1:5173,http://localhost:5173",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowCredentials: true,
	}))
	routes.UserRoutes(app)

	app.Listen(":8080")
}
