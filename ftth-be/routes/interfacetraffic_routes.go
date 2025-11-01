package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func InterfaceTrafficRoutes(app *fiber.App) {
	api := app.Group("/api")

	// Base path: /api/traffic

	// GET /api/traffic
	// Mengambil SEMUA data traffic (bisa sangat besar)
	api.Get("/traffic", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetInterfacesTraffic)

	// POST /api/traffic/add
	// Membuat data traffic baru
	api.Post("/traffic/add", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CreateInterfaceTraffic)

	// GET /api/traffic/interface/:interface_id
	// (Route Kustom) Mengambil data traffic untuk SATU interface spesifik
	// :interface_id adalah ID dari InterfaceMonitoring
	api.Get("/traffic/interface/:interface_id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetTrafficForInterface)

	// GET /api/traffic/:id
	// Mengambil SATU record traffic berdasarkan traffic_id
	// :id adalah ID dari InterfaceTraffic
	api.Get("/traffic/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetInterfaceTraffic)

	// PUT /api/traffic/:id
	// Memperbarui SATU record traffic berdasarkan traffic_id
	api.Put("/traffic/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateInterfaceTraffic)

	// DELETE /api/traffic/:id
	// Melakukan soft-delete pada SATU record traffic berdasarkan traffic_id
	api.Delete("/traffic/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteInterfaceTraffic)
}
