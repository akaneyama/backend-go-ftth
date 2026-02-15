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

	// MANAGE NODES
	api.Post("/nodes", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.AddNetworkNode)

	// [BARU] DELETE NODE
	api.Delete("/nodes/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteNetworkNode)

	// MANAGE CABLES
	api.Post("/cables", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.AddNetworkCable)
	api.Put("/cables/:id/path", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateCablePath)
}
