package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func InterfaceMonitoringRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Get("/interfaces", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetInterfacesMonitoring)
	api.Post("/interfaces/add", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CreateInterfaceMonitoring)
	api.Get("/interfaces/:id", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetInterfaceMonitoring)
	api.Put("/interfaces/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateInterfaceMonitoring)
	api.Delete("/interfaces/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteInterfaceMonitoring)
	api.Get("/interfaces/:id/interfaces-scan", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetInterfacesFromRouter)
	api.Patch("/interfaces/:id/toggle-exclude", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.ToggleExcludeInterface)
}
