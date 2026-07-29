package services

import (
	"strings"

	"github.com/erick/pagosbolivar/internal/models"
	"gorm.io/gorm"
)

func NormalizeLookup(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func FindHabitacionByNumero(db *gorm.DB, numero string, excludeID uint) (models.Habitacion, bool, error) {
	var habitacion models.Habitacion
	query := db.Where("lower(trim(numero)) = ?", NormalizeLookup(numero))
	if excludeID != 0 {
		query = query.Where("id <> ?", excludeID)
	}
	err := query.First(&habitacion).Error
	if err == nil {
		return habitacion, true, nil
	}
	if err == gorm.ErrRecordNotFound {
		return models.Habitacion{}, false, nil
	}
	return models.Habitacion{}, false, err
}

func HasActiveContratoForHabitacion(db *gorm.DB, habitacionID uint, excludeID uint) (bool, error) {
	if habitacionID == 0 {
		return false, nil
	}
	return hasActiveContrato(db.Where("habitacion_id = ?", habitacionID), excludeID)
}

func HasActiveContratoForInquilino(db *gorm.DB, inquilinoID uint, excludeID uint) (bool, error) {
	if inquilinoID == 0 {
		return false, nil
	}
	return hasActiveContrato(db.Where("inquilino_id = ?", inquilinoID), excludeID)
}

func hasActiveContrato(query *gorm.DB, excludeID uint) (bool, error) {
	if excludeID != 0 {
		query = query.Where("id <> ?", excludeID)
	}

	var count int64
	err := query.Model(&models.Contrato{}).Where("estado = ?", "Activo").Count(&count).Error
	return count > 0, err
}
