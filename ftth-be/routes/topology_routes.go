package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func TopologyRoutes(app *fiber.App) {
	api := app.Group("/api")

	// GET Topology
	api.Get("/topology", middleware.JWTProtected(), controllers.GetNetworkTopology)

	// [BARU] SEARCH NODES
	// Usage: /api/nodes/search?q=ODP-RW05
	api.Get("/nodes/search", middleware.JWTProtected(), controllers.SearchNetworkNodes)

	// MANAGE NODES
	api.Post("/nodes", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.AddNetworkNode)
	api.Put("/nodes/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateNetworkNode) // [BARU] Edit Node (geser lokasi)
	api.Delete("/nodes/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteNetworkNode)

	// MANAGE CABLES
	api.Post("/cables", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.AddNetworkCable)
	api.Put("/cables/:id/path", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateCablePath)
	api.Put("/nodes/:id/details", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateNodeDetails)
}
