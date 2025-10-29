package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"sync"

	"github.com/joho/godotenv"
)

var (
	aesKey string
	once   sync.Once
)

func getAESKey() string {
	once.Do(func() {
		_ = godotenv.Load()

		key := os.Getenv("AES_KEY")
		if len(key) != 32 {
			panic("❌ AES_KEY harus 32 karakter (32 bytes untuk AES-256)")
		}
		aesKey = key
	})
	return aesKey
}

func EncryptAES(plainText string) (string, error) {
	key := []byte(getAESKey())

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	ciphertext := make([]byte, aes.BlockSize+len(plainText))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], []byte(plainText))

	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func DecryptAES(cipherText string) (string, error) {
	key := []byte(getAESKey())

	data, err := base64.StdEncoding.DecodeString(cipherText)
	if err != nil {
		return "", err
	}

	if len(data) < aes.BlockSize {
		return "", errors.New("ciphertext terlalu pendek")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	iv := data[:aes.BlockSize]
	data = data[aes.BlockSize:]

	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(data, data)

	return string(data), nil
}
