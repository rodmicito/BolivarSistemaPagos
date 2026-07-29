package services

import (
	"path/filepath"
	"testing"

	"github.com/erick/pagosbolivar/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestFindOrCreateInquilinoReusesExistingRecord(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	defer sqlDB.Close()
	if err := db.AutoMigrate(&models.Inquilino{}, &models.Habitacion{}, &models.Contrato{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}

	first, err := FindOrCreateInquilino(db, models.Inquilino{
		Nombre:    "Maria Lopez",
		Documento: "12345",
		Telefono:  "70000001",
	}, "")
	if err != nil {
		t.Fatalf("create first inquilino: %v", err)
	}

	second, err := FindOrCreateInquilino(db, models.Inquilino{
		Nombre:    "Maria Lopez",
		Documento: "12345",
		Telefono:  "70000002",
	}, "")
	if err != nil {
		t.Fatalf("reuse inquilino: %v", err)
	}

	if first.ID != second.ID {
		t.Fatalf("expected same inquilino id, got %d and %d", first.ID, second.ID)
	}

	var total int64
	if err := db.Model(&models.Inquilino{}).Count(&total).Error; err != nil {
		t.Fatalf("count inquilinos: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected one inquilino row, got %d", total)
	}

	habitacion := models.Habitacion{Numero: "T-01"}
	if err := db.Create(&habitacion).Error; err != nil {
		t.Fatalf("create room: %v", err)
	}

	contratos := []models.Contrato{
		{HabitacionID: habitacion.ID, InquilinoID: first.ID, TipoContrato: "Alquiler", Estado: "Activo"},
		{HabitacionID: habitacion.ID, InquilinoID: second.ID, TipoContrato: "Alquiler", Estado: "Inactivo"},
	}
	if err := db.Create(&contratos).Error; err != nil {
		t.Fatalf("create contracts: %v", err)
	}

	var distinctInquilinos int64
	if err := db.Model(&models.Contrato{}).Distinct("inquilino_id").Count(&distinctInquilinos).Error; err != nil {
		t.Fatalf("count distinct inquilino ids: %v", err)
	}
	if distinctInquilinos != 1 {
		t.Fatalf("expected contracts to share one inquilino_id, got %d", distinctInquilinos)
	}
}
