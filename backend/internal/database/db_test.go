package database

import (
	"path/filepath"
	"testing"

	"github.com/erick/pagosbolivar/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestInitDBBackfillsLegacyInquilinosWithoutDuplicates(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "legacy.db")
	legacyDB, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open legacy database: %v", err)
	}

	stmt := &gorm.Statement{DB: legacyDB}
	if err := stmt.Parse(&models.Contrato{}); err != nil {
		t.Fatalf("parse contrato schema: %v", err)
	}
	tableName := stmt.Schema.Table

	if err := legacyDB.Exec("CREATE TABLE " + tableName + " (id integer primary key autoincrement, habitacion_id integer, inquilino_nombre text, tipo_contrato text, estado text)").Error; err != nil {
		t.Fatalf("create legacy contratos table: %v", err)
	}
	if err := legacyDB.Exec("INSERT INTO " + tableName + " (habitacion_id, inquilino_nombre, tipo_contrato, estado) VALUES (1, 'Ana Rojas', 'Alquiler', 'Activo'), (2, 'Ana Rojas', 'Alquiler', 'Inactivo')").Error; err != nil {
		t.Fatalf("insert legacy contratos: %v", err)
	}

	legacySQL, err := legacyDB.DB()
	if err != nil {
		t.Fatalf("get legacy sql db: %v", err)
	}
	legacySQL.Close()

	db, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("init migrated database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get migrated sql db: %v", err)
	}
	defer sqlDB.Close()

	var inquilinos int64
	if err := db.Model(&models.Inquilino{}).Count(&inquilinos).Error; err != nil {
		t.Fatalf("count inquilinos: %v", err)
	}
	if inquilinos != 1 {
		t.Fatalf("expected one normalized inquilino, got %d", inquilinos)
	}

	var distinctInquilinos int64
	if err := db.Model(&models.Contrato{}).Where("inquilino_id > 0").Distinct("inquilino_id").Count(&distinctInquilinos).Error; err != nil {
		t.Fatalf("count distinct inquilino ids: %v", err)
	}
	if distinctInquilinos != 1 {
		t.Fatalf("expected legacy contracts to share one inquilino_id, got %d", distinctInquilinos)
	}
}
