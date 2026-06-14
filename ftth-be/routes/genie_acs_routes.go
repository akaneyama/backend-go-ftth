package routes

import (
	"akane/be-ftth/controllers"

	"github.com/gofiber/fiber/v2"
)

func GenieACSRoutes(app *fiber.App) {
	api := app.Group("/api/genie-acs")
	
	api.Get("/devices", controllers.GetAllDevicesACS)
	api.Get("/device", controllers.GetDeviceACSInfo)
	api.Get("/hosts", controllers.GetDeviceHostsACS)
	api.Get("/rx-history", controllers.GetDeviceRxHistory)
	api.Post("/wifi", controllers.UpdateDeviceACSWifi)
}
