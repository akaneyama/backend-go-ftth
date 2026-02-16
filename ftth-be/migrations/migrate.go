package migrations

import (
	"akane/be-ftth/config"
	"akane/be-ftth/models"
	"fmt"
	"log"

	"gorm.io/gorm"
)

func RunMigrations() {
	db := config.DB
	err := config.DB.AutoMigrate(
		&models.User{},
		&models.Router{},
		&models.InterfaceMonitoring{},
		&models.InterfaceTraffic{},
		&models.Internetpackage{},
		&models.Log{},
		&models.NetworkCable{},
		&models.NetworkNode{},
		&models.OLT{},
		&models.ODC{},
		&models.ODP{},
		&models.ClientNode{},
	)
	if err != nil {
		fmt.Println("Migration failed:", err)
	} else {
		fmt.Println("Migration success ✅")
	}
	fmt.Println("✅ Migration success, applying foreign keys...")

	if err := applyForeignKeys(db); err != nil {
		log.Printf("⚠️ Error applying foreign keys: %v", err)
	} else {
		fmt.Println("✅ Semua foreign key berhasil ditambahkan!")
	}
}

func applyForeignKeys(db *gorm.DB) error {
	fkQueries := []string{
		`ALTER TABLE interface_monitorings
		 ADD CONSTRAINT fk_interface_monitorings_router
		 FOREIGN KEY (router_id) REFERENCES routers(router_id)
		 ON DELETE CASCADE ON UPDATE CASCADE;`,

		`ALTER TABLE interface_traffics
		 ADD CONSTRAINT fk_interface_traffics_monitoring
		 FOREIGN KEY (interface_id) REFERENCES interface_monitorings(interface_id)
		 ON DELETE CASCADE ON UPDATE CASCADE;`,
	}

	for _, query := range fkQueries {
		fmt.Println("⚙️  " + query)
		if err := db.Exec(query).Error; err != nil {
			if isForeignKeyAlreadyExists(err) {
				fmt.Println("ℹ️  FK sudah ada, dilewati.")
				continue
			}
			return fmt.Errorf("gagal menjalankan query: %v", err)
		}
	}

	return nil
}

func isForeignKeyAlreadyExists(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return containsIgnoreCase(msg, "Duplicate") ||
		containsIgnoreCase(msg, "already exists") ||
		containsIgnoreCase(msg, "errno: 1826")
}

func containsIgnoreCase(str, substr string) bool {
	return len(str) >= len(substr) && (IndexIgnoreCase(str, substr) != -1)
}

func IndexIgnoreCase(str, substr string) int {
	s, sub := toLower(str), toLower(substr)
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func toLower(s string) string {
	out := []rune{}
	for _, r := range s {
		if r >= 'A' && r <= 'Z' {
			out = append(out, r+32)
		} else {
			out = append(out, r)
		}
	}
	return string(out)
}
