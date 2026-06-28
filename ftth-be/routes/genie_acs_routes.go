package routes

import (
	"akane/be-ftth/controllers"
	"akane/be-ftth/middleware"

	"github.com/gofiber/fiber/v2"
)

func GenieACSRoutes(app *fiber.App) {
	api := app.Group("/api/genie-acs", middleware.JWTProtected())
	
	api.Get("/devices", middleware.RoleAdminOrTeknisi(), controllers.GetAllDevicesACS)
	api.Get("/device", middleware.RoleAdminOrTeknisi(), controllers.GetDeviceACSInfo)
	api.Get("/hosts", middleware.RoleAdminOrTeknisi(), controllers.GetDeviceHostsACS)
	api.Get("/rx-history", middleware.RoleAdminOrTeknisi(), controllers.GetDeviceRxHistory)
	api.Post("/wifi", middleware.RoleAdmin(), controllers.UpdateDeviceACSWifi)
}
