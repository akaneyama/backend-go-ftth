package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func ConfigurationRoutes(app *fiber.App) {
	api := app.Group("/api")

	// Endpoint untuk push config
	api.Post("/configure/profile", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.ConfigureRouterProfile)

}
