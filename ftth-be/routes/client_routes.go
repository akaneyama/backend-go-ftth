package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func ClientRoutes(app *fiber.App) {
	api := app.Group("/api", middleware.JWTProtected())

	api.Get("/clients", middleware.RoleAdminOrTeknisi(), controllers.GetClients)
	api.Get("/clients/export", middleware.RoleAdminOrTeknisi(), controllers.ExportClients)
	api.Get("/clients/fats/list", middleware.RoleAdminOrTeknisi(), controllers.GetClientFats)
	api.Get("/clients/import/template", middleware.RoleAdmin(), controllers.GetClientImportTemplate)
	api.Post("/clients/import", middleware.RoleAdmin(), controllers.ImportClients)
	api.Get("/clients/:id", middleware.RoleAdminOrTeknisi(), controllers.GetClient)
	api.Post("/clients", middleware.RoleAdmin(), controllers.CreateClient)
	api.Put("/clients/:id", middleware.RoleAdmin(), controllers.UpdateClient)
	api.Delete("/clients/:id", middleware.RoleAdmin(), controllers.DeleteClient)
	api.Post("/clients/:id/restore", middleware.RoleAdmin(), controllers.RestoreClient)
	api.Post("/clients/:id/sync-mikrotik", middleware.RoleAdmin(), controllers.SyncClientToMikrotik)
}
