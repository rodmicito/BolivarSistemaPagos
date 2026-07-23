package models

import (
	"time"

	"gorm.io/gorm"
)

type Habitacion struct {
	ID                uint    `json:"id" gorm:"primaryKey"`
	Numero            string  `json:"numero"`
	Bloque            string  `json:"bloque"`
	Nivel             string  `json:"nivel"`
	TipoHabitacion    string  `json:"tipo_habitacion"`
	TipoBano          string  `json:"tipo_bano"`
	PrecioAlquiler    float64 `json:"precio_alquiler"`
	PrecioAnticretico float64 `json:"precio_anticretico"`
	PrecioInternet    float64 `json:"precio_internet"`
	Descripcion       string  `json:"descripcion"`
	Disponible        bool    `json:"disponible" gorm:"default:true"`
	Activo            bool    `json:"activo" gorm:"default:true"`
	CreatedAt         time.Time
	UpdatedAt         time.Time
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

type AutomationSetting struct {
	ID               uint   `json:"id" gorm:"primaryKey"`
	Broker           string `json:"broker"`
	RelayCmdTopic    string `json:"relay_cmd_topic"`
	RelayStateTopic  string `json:"relay_state_topic"`
	TelemetryTopic   string `json:"telemetry_topic"`
	KeyPorcentaje    string `json:"key_porcentaje"`
	KeyNivel         string `json:"key_nivel"`
	KeyDistancia     string `json:"key_distancia"`
	KeyCaudalEntrada string `json:"key_caudal_entrada"`
	KeyCaudalSalida  string `json:"key_caudal_salida"`
	KeyBalance       string `json:"key_balance"`
	KeyLm            string `json:"key_lm"`
	KeyLm2           string `json:"key_lm2"`
	SchedulerActive  bool   `json:"scheduler_active"`
	TimeOn           int    `json:"time_on"`
	TimeOff          int    `json:"time_off"`
}


