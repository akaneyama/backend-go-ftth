package middleware

import (
	"akane/be-ftth/utils"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func JWTProtected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.Failed(c, "missing authorization header")
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return utils.Failed(c, "invalid authorization format, use 'Bearer <token>'")
		}

		tokenString := parts[1]
		claims := jwt.MapClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(utils.JwtKey()), nil
		})

		if err != nil || !token.Valid {
			return utils.Failed(c, "invalid or expired token")
		}

		// Simpan claim ke context biar bisa diakses di controller
		c.Locals("email", claims["email"])
		c.Locals("fullname", claims["fullname"])
		c.Locals("role", int(claims["role"].(float64)))

		return c.Next()
	}
}
