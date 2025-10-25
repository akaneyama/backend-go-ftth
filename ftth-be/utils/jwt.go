package utils

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var jwtKey = []byte("SUPER_SECRET_KEY")

func GenerateJWT(email string, role int, fullname string) (string, error) {
	claims := jwt.MapClaims{
		"email":    email,
		"role":     role,
		"fullname": fullname,
		"exp":      time.Now().Add(7 * 24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}
func JwtKey() []byte {
	return jwtKey
}
