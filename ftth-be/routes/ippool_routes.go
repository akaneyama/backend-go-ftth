package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func IPPoolRoutes(app *fiber.App) {
	poolGroup := app.Group("/api/ippools", middleware.JWTProtected())

	poolGroup.Get("/", middleware.RoleAdmin(), controllers.GetIPPools)
	poolGroup.Get("/:id", middleware.RoleAdmin(), controllers.GetIPPool)
	poolGroup.Post("/", middleware.RoleAdmin(), controllers.CreateIPPool)
	poolGroup.Put("/:id", middleware.RoleAdmin(), controllers.UpdateIPPool)
	poolGroup.Delete("/:id", middleware.RoleAdmin(), controllers.DeleteIPPool)
	poolGroup.Get("/:id/available-ips", middleware.RoleAdmin(), controllers.GetAvailableIPs)
}
