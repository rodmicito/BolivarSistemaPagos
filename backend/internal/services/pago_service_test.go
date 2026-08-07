package services

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/erick/pagosbolivar/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestCrearPagosMensualesDelAnioIsIdempotent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	defer sqlDB.Close()

	if err := db.AutoMigrate(&models.PagoMensual{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}

	contrato := models.Contrato{
		ID:              10,
		TipoContrato:    "Alquiler",
		MontoMensual:    1000,
		MontoServicios:  50,
		IncluyeInternet: true,
		MontoInternet:   80,
		FechaInicio:     time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC),
		Estado:          "Activo",
	}

	if err := CrearPagosMensualesDelAnio(db, contrato, 2026); err != nil {
		t.Fatalf("create payments first run: %v", err)
	}
	if err := CrearPagosMensualesDelAnio(db, contrato, 2026); err != nil {
		t.Fatalf("create payments second run: %v", err)
	}

	var total int64
	if err := db.Model(&models.PagoMensual{}).Where("contrato_id = ? AND anio = ?", contrato.ID, 2026).Count(&total).Error; err != nil {
		t.Fatalf("count payments: %v", err)
	}
	if total != 12 {
		t.Fatalf("expected 12 monthly payments, got %d", total)
	}

	var duplicatePeriods int64
	if err := db.Raw(
		"SELECT COUNT(*) FROM (SELECT contrato_id, anio, mes, COUNT(*) AS total FROM pago_mensuals GROUP BY contrato_id, anio, mes HAVING total > 1)",
	).Scan(&duplicatePeriods).Error; err != nil {
		t.Fatalf("count duplicate periods: %v", err)
	}
	if duplicatePeriods != 0 {
		t.Fatalf("expected no duplicate payment periods, got %d", duplicatePeriods)
	}
}

func TestActualizarVencimientosPagosNoCobradosSkipsPaidPayments(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	defer sqlDB.Close()

	if err := db.AutoMigrate(&models.PagoMensual{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}

	contrato := models.Contrato{
		ID:           20,
		TipoContrato: "Alquiler",
		MontoMensual: 750,
		FechaInicio:  time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC),
	}

	pagadoVencimiento := time.Date(2026, 2, 5, 0, 0, 0, 0, time.UTC)
	pagos := []models.PagoMensual{
		{ContratoID: contrato.ID, Anio: 2026, Mes: 1, MontoTotal: 100, EstadoPago: "Pendiente", FechaVencimiento: time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC)},
		{ContratoID: contrato.ID, Anio: 2026, Mes: 2, MontoTotal: 100, MontoPagado: 100, EstadoPago: "Pagado", FechaVencimiento: pagadoVencimiento},
	}
	if err := db.Create(&pagos).Error; err != nil {
		t.Fatalf("create payments: %v", err)
	}

	if err := ActualizarVencimientosPagosNoCobrados(db, contrato); err != nil {
		t.Fatalf("update due dates: %v", err)
	}

	var pendiente models.PagoMensual
	if err := db.Where("contrato_id = ? AND mes = ?", contrato.ID, 1).First(&pendiente).Error; err != nil {
		t.Fatalf("load pending payment: %v", err)
	}
	if pendiente.FechaVencimiento.Day() != 10 {
		t.Fatalf("expected pending due day 10, got %d", pendiente.FechaVencimiento.Day())
	}
	if pendiente.MontoTotal != 750 {
		t.Fatalf("expected pending total 750, got %.2f", pendiente.MontoTotal)
	}

	var pagado models.PagoMensual
	if err := db.Where("contrato_id = ? AND mes = ?", contrato.ID, 2).First(&pagado).Error; err != nil {
		t.Fatalf("load paid payment: %v", err)
	}
	if !pagado.FechaVencimiento.Equal(pagadoVencimiento) {
		t.Fatalf("expected paid due date to stay %v, got %v", pagadoVencimiento, pagado.FechaVencimiento)
	}
}
