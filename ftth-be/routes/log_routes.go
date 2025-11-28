package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func LogRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Get("/logs", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetLogs)
	api.Get("/logs/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetLogByID)
}
