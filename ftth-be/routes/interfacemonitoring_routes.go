package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func InterfaceMonitoringRoutes(app *fiber.App) {
	api := app.Group("/api")

	// Base path: /api/interfaces

	// GET /api/interfaces
	// Mengambil semua data interface
	api.Get("/interfaces", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetInterfacesMonitoring)

	// POST /api/interfaces/add
	// Membuat data interface baru
	api.Post("/interfaces/add", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CreateInterfaceMonitoring)

	// GET /api/interfaces/:id
	// Mengambil satu data interface berdasarkan interface_id
	api.Get("/interfaces/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetInterfaceMonitoring)

	// PUT /api/interfaces/:id
	// Memperbarui data interface berdasarkan interface_id
	api.Put("/interfaces/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateInterfaceMonitoring)

	// DELETE /api/interfaces/:id
	// Melakukan soft-delete pada interface berdasarkan interface_id
	api.Delete("/interfaces/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteInterfaceMonitoring)
}
