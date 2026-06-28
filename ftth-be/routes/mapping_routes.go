package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func MappingRoutes(app *fiber.App) {
	api := app.Group("/api")

	// Get Router ID mapped to ODP Name
	api.Get("/mappings/by-odp-name/:name", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetRouterByODPName)

	// CRUD Mappings
	api.Get("/mappings", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetTopologyMappings)
	api.Get("/mappings/:id", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetTopologyMapping)
	api.Post("/mappings", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CreateTopologyMapping)
	api.Put("/mappings/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateTopologyMapping)
	api.Delete("/mappings/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteTopologyMapping)
}
