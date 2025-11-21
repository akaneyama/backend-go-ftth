package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func RouterRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Get("/routers", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetRouters)
	api.Post("/routers/add", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CreateRouter)
	api.Get("/routers/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.GetRouter)
	api.Put("/routers/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateRouter)
	api.Delete("/routers/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteRouter)
	api.Post("/routers/test-connection", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.TestRouterConnection)
}
