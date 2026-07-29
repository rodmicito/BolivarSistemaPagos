package services

import (
	"strings"

	"github.com/erick/pagosbolivar/internal/models"
	"gorm.io/gorm"
)

func FindOrCreateInquilino(db *gorm.DB, input models.Inquilino, fallbackName string) (models.Inquilino, error) {
	if input.ID != 0 {
		var existing models.Inquilino
		if err := db.First(&existing, input.ID).Error; err != nil {
			return models.Inquilino{}, err
		}
		return updateMissingInquilinoFields(db, existing, normalizeInquilinoInput(input, fallbackName))
	}

	input = normalizeInquilinoInput(input, fallbackName)

	if input.Nombre == "" {
		return models.Inquilino{}, gorm.ErrRecordNotFound
	}

	var existing models.Inquilino
	if input.Documento != "" {
		err := db.Where("documento = ?", input.Documento).First(&existing).Error
		if err == nil {
			return updateMissingInquilinoFields(db, existing, input)
		}
		if err != gorm.ErrRecordNotFound {
			return models.Inquilino{}, err
		}
	}

	err := db.Where("lower(trim(nombre)) = lower(trim(?))", input.Nombre).First(&existing).Error
	if err == nil {
		return updateMissingInquilinoFields(db, existing, input)
	}
	if err != gorm.ErrRecordNotFound {
		return models.Inquilino{}, err
	}

	if err := db.Create(&input).Error; err != nil {
		return models.Inquilino{}, err
	}
	return input, nil
}

func SyncContratoInquilinoNombre(contrato *models.Contrato) {
	if contrato == nil {
		return
	}
	if contrato.Inquilino.Nombre != "" {
		contrato.InquilinoNombre = contrato.Inquilino.Nombre
	}
}

func SyncContratosInquilinoNombre(contratos []models.Contrato) {
	for i := range contratos {
		SyncContratoInquilinoNombre(&contratos[i])
	}
}

func BackfillLegacyInquilinos(db *gorm.DB, tableName string, hasLegacyName bool) error {
	if !hasLegacyName {
		return nil
	}

	type legacyContrato struct {
		ID              uint
		InquilinoID     uint
		InquilinoNombre string
	}

	var rows []legacyContrato
	if err := db.Raw(
		"SELECT id, COALESCE(inquilino_id, 0) AS inquilino_id, COALESCE(inquilino_nombre, '') AS inquilino_nombre FROM " + tableName + " WHERE COALESCE(inquilino_id, 0) = 0 AND trim(COALESCE(inquilino_nombre, '')) <> ''",
	).Scan(&rows).Error; err != nil {
		return err
	}

	for _, row := range rows {
		inquilino, err := FindOrCreateInquilino(db, models.Inquilino{Nombre: row.InquilinoNombre}, row.InquilinoNombre)
		if err != nil {
			return err
		}
		if err := db.Model(&models.Contrato{}).Where("id = ?", row.ID).Update("inquilino_id", inquilino.ID).Error; err != nil {
			return err
		}
	}

	return nil
}

func updateMissingInquilinoFields(db *gorm.DB, existing models.Inquilino, input models.Inquilino) (models.Inquilino, error) {
	changed := false
	if input.Nombre != "" && existing.Nombre != input.Nombre {
		existing.Nombre = input.Nombre
		changed = true
	}
	if input.Documento != "" && existing.Documento != input.Documento {
		existing.Documento = input.Documento
		changed = true
	}
	if input.Telefono != "" && existing.Telefono != input.Telefono {
		existing.Telefono = input.Telefono
		changed = true
	}
	if input.Email != "" && existing.Email != input.Email {
		existing.Email = input.Email
		changed = true
	}
	if input.Observaciones != "" && existing.Observaciones != input.Observaciones {
		existing.Observaciones = input.Observaciones
		changed = true
	}
	if changed {
		return existing, db.Save(&existing).Error
	}
	return existing, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func normalizeInquilinoInput(input models.Inquilino, fallbackName string) models.Inquilino {
	input.Nombre = strings.TrimSpace(firstNonEmpty(input.Nombre, fallbackName))
	input.Documento = strings.TrimSpace(input.Documento)
	input.Telefono = strings.TrimSpace(input.Telefono)
	input.Email = strings.TrimSpace(input.Email)
	input.Observaciones = strings.TrimSpace(input.Observaciones)
	input.Activo = true
	return input
}
