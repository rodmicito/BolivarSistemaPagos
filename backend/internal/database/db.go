package database

import (
	"log"

	"github.com/erick/pagosbolivar/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func InitDB(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	log.Println("Database connected successfully.")

	// Auto Migrate the schema
	err = db.AutoMigrate(&models.Habitacion{}, &models.Contrato{}, &models.PagoMensual{}, &models.AutomationSetting{})
	if err != nil {
		log.Printf("Failed to auto migrate: %v", err)
		return nil, err
	}
	
	log.Println("Database schema migrated.")

	return db, nil
}
