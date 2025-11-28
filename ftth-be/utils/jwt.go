package utils

import (
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Ambil Secret Key (Gunakan Env Variable untuk produksi)
func getSecretKey() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return []byte("SUPER_SECRET_KEY") // Default fallback
	}
	return []byte(secret)
}

// Helper agar middleware bisa mengambil key ini
func JwtKey() []byte {
	return getSecretKey()
}

// GenerateJWT membuat token baru saat login
func GenerateJWT(email string, role int, fullname string) (string, error) {
	claims := jwt.MapClaims{
		"email":    email,
		"role":     role,
		"fullname": fullname,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getSecretKey())
}

// --- FUNGSI INI DISESUAIKAN DENGAN MIDDLEWARE KAMU ---
// GetUserFromContext mengambil Email user dari c.Locals
func GetUserFromContext(c *fiber.Ctx) string {
	// Middleware kamu menyimpan email langsung dengan key "email"
	email := c.Locals("email")

	// Jika nil (belum login / middleware error), return default
	if email == nil {
		return "System/Unknown"
	}

	// Lakukan Type Assertion ke string
	if emailStr, ok := email.(string); ok {
		return emailStr
	}

	return "Unknown User"
}
