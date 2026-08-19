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

	err = db.AutoMigrate(&models.Habitacion{}, &models.Inquilino{}, &models.Contrato{}, &models.PagoMensual{}, &models.AutomationSetting{}, &models.TelemetryLog{}, &models.BackupSetting{})
	if err != nil {
		log.Printf("Failed to auto migrate: %v", err)
		return nil, err
	}

	if err := backfillLegacyInquilinos(db); err != nil {
		log.Printf("Failed to backfill inquilinos: %v", err)
		return nil, err
	}
	if err := ensurePagoMensualUniqueIndex(db); err != nil {
		log.Printf("Failed to ensure payment uniqueness: %v", err)
		return nil, err
	}
	if err := deduplicateActiveContratos(db); err != nil {
		log.Printf("Failed to deduplicate active contratos: %v", err)
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

func ensurePagoMensualUniqueIndex(db *gorm.DB) error {
	stmt := &gorm.Statement{DB: db}
	if err := stmt.Parse(&models.PagoMensual{}); err != nil {
		return err
	}
	tableName := stmt.Schema.Table

	if err := db.Exec(
		"DELETE FROM " + tableName + " WHERE id NOT IN (SELECT MIN(id) FROM " + tableName + " GROUP BY contrato_id, anio, mes)",
	).Error; err != nil {
		return err
	}

	return db.Exec(
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_pago_mensual_unique_period ON " + tableName + " (contrato_id, anio, mes)",
	).Error
}

// deduplicateActiveContratos fixes legacy data where a habitacion or inquilino
// ended up with more than one Contrato in estado='Activo' (from before the
// duplicate guard existed). It keeps the most recently updated one Activo and
// marks the rest Inactivo, so occupancy checks based on a single active
// contract per room/tenant behave correctly.
func deduplicateActiveContratos(db *gorm.DB) error {
	stmt := &gorm.Statement{DB: db}
	if err := stmt.Parse(&models.Contrato{}); err != nil {
		return err
	}
	tableName := stmt.Schema.Table

	dedupeByColumn := func(column string) error {
		return db.Exec(`
			UPDATE ` + tableName + `
			SET estado = 'Inactivo'
			WHERE estado = 'Activo'
			AND id NOT IN (
				SELECT id FROM (
					SELECT id, ROW_NUMBER() OVER (
						PARTITION BY ` + column + `
						ORDER BY updated_at DESC, id DESC
					) AS rn
					FROM ` + tableName + `
					WHERE estado = 'Activo'
				) ranked WHERE rn = 1
			)
		`).Error
	}

	if err := dedupeByColumn("habitacion_id"); err != nil {
		return err
	}
	return dedupeByColumn("inquilino_id")
}
