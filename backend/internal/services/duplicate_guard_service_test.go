package services

import (
	"path/filepath"
	"testing"

	"github.com/erick/pagosbolivar/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestDuplicateGuardsDetectExistingRoomsAndActiveContracts(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	defer sqlDB.Close()

	if err := db.AutoMigrate(&models.Habitacion{}, &models.Inquilino{}, &models.Contrato{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}

	habitacion := models.Habitacion{Numero: "A-101"}
	inquilino := models.Inquilino{Nombre: "Pedro Vargas", Activo: true}
	if err := db.Create(&habitacion).Error; err != nil {
		t.Fatalf("create room: %v", err)
	}
	if err := db.Create(&inquilino).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	contrato := models.Contrato{
		HabitacionID: habitacion.ID,
		InquilinoID:  inquilino.ID,
		Estado:       "Activo",
	}
	if err := db.Create(&contrato).Error; err != nil {
		t.Fatalf("create contract: %v", err)
	}

	if _, exists, err := FindHabitacionByNumero(db, " a-101 ", 0); err != nil {
		t.Fatalf("find room: %v", err)
	} else if !exists {
		t.Fatal("expected duplicate room to be detected")
	}

	if exists, err := HasActiveContratoForHabitacion(db, habitacion.ID, 0); err != nil {
		t.Fatalf("check room contract: %v", err)
	} else if !exists {
		t.Fatal("expected active room contract to be detected")
	}

	if exists, err := HasActiveContratoForInquilino(db, inquilino.ID, 0); err != nil {
		t.Fatalf("check tenant contract: %v", err)
	} else if !exists {
		t.Fatal("expected active tenant contract to be detected")
	}

	if exists, err := HasActiveContratoForHabitacion(db, habitacion.ID, contrato.ID); err != nil {
		t.Fatalf("check excluded room contract: %v", err)
	} else if exists {
		t.Fatal("expected excluded active contract to be ignored")
	}
}
