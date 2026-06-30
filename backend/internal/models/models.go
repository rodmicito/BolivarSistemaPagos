package models

import (
	"time"

	"gorm.io/gorm"
)

type Habitacion struct {
	ID          uint   `json:"id" gorm:"primaryKey"`
	Numero      string `json:"numero"`
	Bloque      string `json:"bloque"`
	Descripcion string `json:"descripcion"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Contrato struct {
	ID               uint      `json:"id" gorm:"primaryKey"`
	HabitacionID     uint      `json:"habitacion_id"`
	Habitacion       Habitacion `json:"habitacion" gorm:"foreignKey:HabitacionID"`
	InquilinoNombre  string    `json:"inquilino_nombre"`
	TipoContrato     string    `json:"tipo_contrato"` // Alquiler o Anticretico
	MontoMensual     float64   `json:"monto_mensual"`
	MontoServicios   float64   `json:"monto_servicios"`
	IncluyeInternet  bool      `json:"incluye_internet"`
	MontoInternet    float64   `json:"monto_internet"`
	MontoGarantia    float64   `json:"monto_garantia"`
	FechaInicio      time.Time `json:"fecha_inicio"`
	FechaFin         *time.Time `json:"fecha_fin"`
	Estado           string    `json:"estado"` // Activo, Inactivo
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type PagoMensual struct {
	ID               uint       `json:"id" gorm:"primaryKey"`
	ContratoID       uint       `json:"contrato_id"`
	Contrato         Contrato   `json:"contrato" gorm:"foreignKey:ContratoID"`
	Anio             int        `json:"anio"`
	Mes              int        `json:"mes"`
	MontoAlquiler    float64    `json:"monto_alquiler"`
	MontoServicios   float64    `json:"monto_servicios"`
	MontoInternet    float64    `json:"monto_internet"`
	MontoTotal       float64    `json:"monto_total"`
	MontoPagado      float64    `json:"monto_pagado"`
	FechaVencimiento time.Time  `json:"fecha_vencimiento"`
	FechaPago        *time.Time `json:"fecha_pago"`
	EstadoPago       string     `json:"estado_pago"` // Pendiente, Pagado, Parcial, Vencido
	Observaciones    string     `json:"observaciones"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
	DeletedAt        gorm.DeletedAt `gorm:"index"`
}
