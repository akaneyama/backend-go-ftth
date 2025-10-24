package utils

import "github.com/gofiber/fiber/v2"

type APIResponse struct {
	HttpCode int         `json:"httpCode"`
	Status   string      `json:"status"`
	Category string      `json:"category"`
	Remark   string      `json:"remark"`
	Data     interface{} `json:"data"`
}

func Success(c *fiber.Ctx, remark string, data interface{}) error {
	return c.Status(fiber.StatusOK).JSON(APIResponse{
		HttpCode: fiber.StatusOK,
		Status:   "success",
		Category: "success response",
		Remark:   remark,
		Data:     data,
	})
}

func Failed(c *fiber.Ctx, remark string) error {
	return c.Status(fiber.StatusBadRequest).JSON(APIResponse{
		HttpCode: fiber.StatusBadRequest,
		Status:   "failed",
		Category: "failed response",
		Remark:   remark,
		Data:     nil,
	})
}

func Error(c *fiber.Ctx, remark string) error {
	return c.Status(fiber.StatusInternalServerError).JSON(APIResponse{
		HttpCode: fiber.StatusInternalServerError,
		Status:   "error",
		Category: "error response",
		Remark:   remark,
		Data:     nil,
	})
}
