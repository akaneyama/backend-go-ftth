package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func ClientRoutes(app *fiber.App) {
	api := app.Group("/api", middleware.JWTProtected())

	api.Get("/clients", controllers.GetClients)
	api.Get("/clients/export", controllers.ExportClients)
	api.Get("/clients/import/template", controllers.GetClientImportTemplate)
	api.Post("/clients/import", controllers.ImportClients)
	api.Get("/clients/:id", controllers.GetClient)
	api.Post("/clients", controllers.CreateClient)
	api.Put("/clients/:id", controllers.UpdateClient)
	api.Delete("/clients/:id", controllers.DeleteClient)
	api.Post("/clients/:id/restore", controllers.RestoreClient)
}
