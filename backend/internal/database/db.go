package database

import (
	"log"

	"github.com/erick/pagosbolivar/internal/models"
	"github.com/erick/pagosbolivar/internal/services"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func InitDB(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	log.Println("Database connected successfully.")

	err = db.AutoMigrate(&models.Habitacion{}, &models.Inquilino{}, &models.Contrato{}, &models.PagoMensual{}, &models.AutomationSetting{}, &models.TelemetryLog{})
	if err != nil {
		log.Printf("Failed to auto migrate: %v", err)
		return nil, err
	}

	if err := backfillLegacyInquilinos(db); err != nil {
		log.Printf("Failed to backfill inquilinos: %v", err)
		return nil, err
	}

	log.Println("Database schema migrated.")

	return db, nil
}

func backfillLegacyInquilinos(db *gorm.DB) error {
	stmt := &gorm.Statement{DB: db}
	if err := stmt.Parse(&models.Contrato{}); err != nil {
		return err
	}
	tableName := stmt.Schema.Table
	hasLegacyName := db.Migrator().HasColumn(tableName, "inquilino_nombre")
	return services.BackfillLegacyInquilinos(db, tableName, hasLegacyName)
}
