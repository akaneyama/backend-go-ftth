package routes

import (
	"akane/be-ftth/controllers"

	"github.com/gofiber/fiber/v2"
)

func UserRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Post("/register", controllers.CreateUser)
	api.Post("/login", controllers.LoginUser)

	api.Get("/users", controllers.GetUsers)
	api.Get("/users/:id", controllers.GetUser)
	api.Put("/users/:id", controllers.UpdateUser)
	api.Delete("/users/:id", controllers.DeleteUser)
}
