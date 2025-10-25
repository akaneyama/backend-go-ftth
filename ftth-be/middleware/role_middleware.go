package middleware

import (
	"akane/be-ftth/utils"

	"github.com/gofiber/fiber/v2"
)

func RoleAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role := c.Locals("role").(int)
		if role != 1 {
			return utils.Failed(c, "access denied: admin only")
		}
		return c.Next()
	}
}

func RoleAdminOrTeknisi() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role := c.Locals("role").(int)
		if role != 1 && role != 2 {
			return utils.Failed(c, "access denied: admin or teknisi only")
		}
		return c.Next()
	}
}

func RoleTeknisi() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role := c.Locals("role").(int)
		if role != 2 {
			return utils.Failed(c, "access denied: teknisi only")
		}
		return c.Next()
	}
}

func RoleUser() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role := c.Locals("role").(int)
		if role != 3 {
			return utils.Failed(c, "access denied: user only")
		}
		return c.Next()
	}
}
