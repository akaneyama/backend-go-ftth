package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func RouterRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Get("/routers", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetRouters)
	api.Post("/routers/add", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CreateRouter)
	api.Get("/routers/:id", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetRouter)
	api.Put("/routers/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateRouter)
	api.Delete("/routers/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteRouter)
	api.Post("/routers/test-connection", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.TestRouterConnection)
	api.Post("/routers/test-pppoe", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.TestPPPoEConnection)
	api.Post("/routers/check-pppoe", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.CheckPPPoEExists)
	api.Get("/routers/:id/ppp-profiles", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetRouterPPPProfiles)
}
