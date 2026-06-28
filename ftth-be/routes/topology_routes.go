package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func TopologyRoutes(app *fiber.App) {
	api := app.Group("/api")

	// GET Topology (untuk peta)
	api.Get("/topology", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetNetworkTopology)

	// GET Topology Table (untuk halaman tabel & ekspor Excel)
	api.Get("/topology/table", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetTopologyTable)

	// SEARCH NODES
	api.Get("/nodes/search", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.SearchNetworkNodes)

	// MANAGE NODES
	api.Post("/nodes", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.AddNetworkNode)
	api.Put("/nodes/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateNetworkNode)
	api.Delete("/nodes/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteNetworkNode)
	api.Put("/nodes/:id/details", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateNodeDetails)

	// MANAGE CABLES
	api.Post("/cables", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.AddNetworkCable)
	api.Put("/cables/:id/path", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateCablePath)
	api.Put("/cables/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateCableDetails)
	api.Delete("/cables/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteNetworkCable)

	// BATCH ISOLIR TOOLS
	api.Post("/tools/isolir/upload", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.ToolIsolirUpload)
	api.Post("/tools/isolir/process", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.ToolIsolirProcess)
	api.Get("/tools/isolir/status/:task_id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.ToolIsolirStatus)
	api.Get("/tools/isolir/template", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.ToolIsolirTemplate)

	// DASHBOARD INFO
	api.Get("/dashboard/stats", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetDashboardStats)
	api.Get("/dashboard/logs", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetDashboardLogs)
}
