package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func InternetPackageRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Get("/internetpackages", controllers.GetInternetPackages)
	api.Get("/internetpackages/:id", controllers.GetInternetPackage)
	api.Post("/internetpackages/add", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CreatePackage)
	api.Put("/internetpackages/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateInternetPackage)
	api.Delete("/internetpackages/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeletePackage)

}
