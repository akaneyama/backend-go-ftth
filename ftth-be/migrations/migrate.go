package migrations

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"fmt"
)

func RunMigrations() {
	err := config.DB.AutoMigrate(
		&models.User{},
		&models.Router{}, &models.Internetpackage{})
	if err != nil {
		fmt.Println("Migration failed:", err)
	} else {
		fmt.Println("Migration success ✅")
	}
}
