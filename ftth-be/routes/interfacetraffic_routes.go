package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func InterfaceTrafficRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Get("/traffic", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetInterfacesTraffic)
	api.Post("/traffic/add", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CreateInterfaceTraffic)
	api.Get("/traffic/interface/:interface_id", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetTrafficForInterface)
	api.Get("/traffic/:id", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetInterfaceTraffic)
	api.Put("/traffic/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateInterfaceTraffic)
	api.Delete("/traffic/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteInterfaceTraffic)
	api.Post("/traffic/sync-now", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.ManualTrafficSync)
}
