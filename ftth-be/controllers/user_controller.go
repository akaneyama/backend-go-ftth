package controllers

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"akane/be-ftth/utils"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

func CreateUser(c *fiber.Ctx) error {

	adminPelaku := utils.GetUserFromContext(c)

	var user models.User
	if err := c.BodyParser(&user); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	if user.Email == "" || user.Password == "" {
		return utils.Failed(c, "email and password are required")
	}

	if user.Role == 0 {
		user.Role = 3
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(user.Password), 10)
	user.Password = string(hash)

	if err := config.DB.Create(&user).Error; err != nil {
		return utils.Error(c, "failed to insert data")
	}

	logDesc := fmt.Sprintf("Create User baru: %s (Role: %d)", user.Email, user.Role)
	utils.CreateLog(adminPelaku, "USER", "INFO", logDesc)

	return utils.Success(c, "success insert data", nil)
}

func LoginUser(c *fiber.Ctx) error {

	var login models.User
	if err := c.BodyParser(&login); err != nil {
		utils.CreateLog("System/Guest", "LOGIN", "ERROR", "Invalid Request Body saat Login")
		return utils.Failed(c, "invalid request body")
	}

	pelaku := login.Email

	if login.Email == "" || login.Password == "" {
		utils.CreateLog("System/Guest", "LOGIN", "WARNING", "Login attempt empty email/pass")
		return utils.Failed(c, "email and password are required")
	}

	var user models.User
	result := config.DB.Where("email = ?", login.Email).First(&user)
	if result.Error != nil {
		utils.CreateLog(pelaku, "LOGIN", "WARNING", "Login failed: Email not found")
		return utils.Failed(c, "email not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(login.Password)); err != nil {
		utils.CreateLog(pelaku, "LOGIN", "WARNING", "Login failed: Invalid Password")
		return utils.Failed(c, "invalid password")
	}

	token, err := utils.GenerateJWT(user.Email, user.Role, user.Fullname)
	if err != nil {
		utils.CreateLog(pelaku, "LOGIN", "ERROR", "Failed Generate JWT")
		return utils.Error(c, "failed generate jwt")
	}

	user.Password = ""

	utils.CreateLog(pelaku, "LOGIN", "SUCCESS", "User Logged In Successfully")

	return utils.Success(c, "login success", fiber.Map{
		"token": token,
	})
}

func GetUsers(c *fiber.Ctx) error {
	var users []models.User
	config.DB.Where("is_deleted = ?", 0).Find(&users)

	for i := range users {
		users[i].Password = ""
	}

	return utils.Success(c, "success retrieve data", users)
}

func GetUser(c *fiber.Ctx) error {
	id := c.Params("id")
	var user models.User
	result := config.DB.Where("id = ? AND is_deleted = ?", id, 0).First(&user)
	if result.Error != nil {
		return utils.Failed(c, "user not found or deleted")
	}

	user.Password = ""
	return utils.Success(c, "success retrieve data", user)
}

func UpdateUser(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	id := c.Params("id")
	var user models.User
	if err := config.DB.First(&user, id).Error; err != nil {
		return utils.Failed(c, "user not found")
	}

	var payload models.User
	if err := c.BodyParser(&payload); err != nil {
		return utils.Failed(c, "invalid request body")
	}

	oldData := fmt.Sprintf("%s (Role %d)", user.Fullname, user.Role)

	user.Fullname = payload.Fullname
	user.Role = payload.Role

	passChange := ""
	if payload.Password != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(payload.Password), 10)
		user.Password = string(hash)
		passChange = "Password Changed. "
	}

	config.DB.Save(&user)

	logDesc := fmt.Sprintf("Update User ID %s. %sFrom [%s] To [%s (Role %d)]", id, passChange, oldData, user.Fullname, user.Role)
	utils.CreateLog(adminPelaku, "USER", "INFO", logDesc)

	return utils.Success(c, "success update data", nil)
}

func DeleteUser(c *fiber.Ctx) error {
	adminPelaku := utils.GetUserFromContext(c)

	id := c.Params("id")

	var user models.User
	if err := config.DB.First(&user, id).Error; err != nil {
		return utils.Failed(c, "user not found")
	}

	if user.IsDeleted == 1 {
		return utils.Failed(c, "user already deleted")
	}

	user.IsDeleted = 1
	if err := config.DB.Save(&user).Error; err != nil {
		return utils.Error(c, "failed to mark user as deleted")
	}

	logDesc := fmt.Sprintf("User Deleted (Soft): %s (ID: %s)", user.Email, id)
	utils.CreateLog(adminPelaku, "USER", "DANGER", logDesc)

	return utils.Success(c, "success soft delete user", nil)
}
