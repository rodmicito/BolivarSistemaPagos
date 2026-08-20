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

type Inquilino struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	Nombre        string `json:"nombre" gorm:"not null;index"`
	Documento     string `json:"documento" gorm:"index"`
	Telefono      string `json:"telefono"`
	Email         string `json:"email"`
	Observaciones string `json:"observaciones"`
	Activo        bool   `json:"activo" gorm:"default:true"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type Contrato struct {
	ID              uint       `json:"id" gorm:"primaryKey"`
	HabitacionID    uint       `json:"habitacion_id"`
	Habitacion      Habitacion `json:"habitacion" gorm:"foreignKey:HabitacionID"`
	InquilinoID     uint       `json:"inquilino_id" gorm:"index"`
	Inquilino       Inquilino  `json:"inquilino" gorm:"foreignKey:InquilinoID"`
	InquilinoNombre string     `json:"inquilino_nombre" gorm:"-"`
	TipoContrato    string     `json:"tipo_contrato"` // Alquiler o Anticretico
	MontoMensual    float64    `json:"monto_mensual"`
	MontoServicios  float64    `json:"monto_servicios"`
	IncluyeInternet bool       `json:"incluye_internet"`
	MontoInternet   float64    `json:"monto_internet"`
	MontoGarantia   float64    `json:"monto_garantia"`
	FechaInicio     time.Time  `json:"fecha_inicio"`
	FechaFin        *time.Time `json:"fecha_fin"`
	Estado          string     `json:"estado"` // Activo, Inactivo
	CreatedAt       time.Time
	UpdatedAt       time.Time
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
	ID                 uint   `json:"id" gorm:"primaryKey"`
	Broker             string `json:"broker"`
	RelayCmdTopic      string `json:"relay_cmd_topic"`
	RelayStateTopic    string `json:"relay_state_topic"`
	TelemetryTopic     string `json:"telemetry_topic"`
	KeyPorcentaje      string `json:"key_porcentaje"`
	KeyNivel           string `json:"key_nivel"`
	KeyDistancia       string `json:"key_distancia"`
	KeyCaudalEntrada   string `json:"key_caudal_entrada"`
	KeyCaudalSalida    string `json:"key_caudal_salida"`
	KeyBalance         string `json:"key_balance"`
	KeyLm              string `json:"key_lm"`
	KeyLm2             string `json:"key_lm2"`
	SchedulerActive    bool   `json:"scheduler_active"`
	TimeOn             int    `json:"time_on"`
	TimeOff            int    `json:"time_off"`
	DbLogActive        bool   `json:"db_log_active"`
	DbLogInterval      int    `json:"db_log_interval"`
	AutoOffDuration    int    `json:"auto_off_duration"`
	DbLogRetentionDays int    `json:"db_log_retention_days"`
	TelemetryFreshMin  int    `json:"telemetry_fresh_min"`
	TelemetryWarnMin   int    `json:"telemetry_warn_min"`
	TelemetryAlertMin  int    `json:"telemetry_alert_min"`
}

type TelemetryLog struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	Timestamp     time.Time `json:"timestamp" gorm:"index"`
	Porcentaje    float64   `json:"porcentaje"`
	Nivel         float64   `json:"nivel"`
	Distancia     float64   `json:"distancia"`
	CaudalEntrada float64   `json:"caudal_entrada"`
	CaudalSalida  float64   `json:"caudal_salida"`
	Balance       float64   `json:"balance"`
	Lm            float64   `json:"lm"`
	Lm2           float64   `json:"lm2"`
	RelayState    string    `json:"relay_state"`
	RelayCmd      string    `json:"relay_cmd"`
}

type BackupSetting struct {
	ID              uint       `json:"id" gorm:"primaryKey"`
	Enabled         bool       `json:"enabled"`
	IntervalMinutes int        `json:"interval_minutes"`
	RetentionCount  int        `json:"retention_count"`
	BackupDir       string     `json:"backup_dir"`
	LastRunAt       *time.Time `json:"last_run_at"`
	LastBackupFile  string     `json:"last_backup_file"`
	LastBackupSize  int64      `json:"last_backup_size"`
	LastBackupError string     `json:"last_backup_error"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
