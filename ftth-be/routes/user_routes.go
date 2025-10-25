package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func UserRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Post("/register", controllers.CreateUser)
	api.Post("/login", controllers.LoginUser)

	api.Get("/users", middleware.JWTProtected(), middleware.RoleAdminOrTeknisi(), controllers.GetUsers)
	api.Get("/users/:id", middleware.JWTProtected(), controllers.GetUser)
	api.Put("/users/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.UpdateUser)
	api.Delete("/users/:id", middleware.JWTProtected(), middleware.RoleAdmin(), controllers.DeleteUser)
}
