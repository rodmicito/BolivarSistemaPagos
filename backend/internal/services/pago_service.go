package services

import (
	"time"
	"gorm.io/gorm"

	"github.com/erick/pagosbolivar/internal/models"
)

// CalcularFechaVencimiento calculates the due date for a given month and start date
func CalcularFechaVencimiento(fechaInicio time.Time, mes int, anio int) time.Time {
	diaInicio := fechaInicio.Day()
	
	// Get first day of the target month
	firstOfMonth := time.Date(anio, time.Month(mes), 1, 0, 0, 0, 0, time.UTC)
	// Get last day by adding 1 month and subtracting 1 day
	lastOfMonth := firstOfMonth.AddDate(0, 1, -1)
	
	diaVencimiento := diaInicio
	if diaInicio > lastOfMonth.Day() {
		diaVencimiento = lastOfMonth.Day()
	}
	
	return time.Date(anio, time.Month(mes), diaVencimiento, 0, 0, 0, 0, time.UTC)
}

// DeterminarEstadoPago evaluates the current state based on money paid and dates
func DeterminarEstadoPago(estadoSugerido string, fechaVencimiento time.Time, montoTotal float64, montoPagado float64) string {
	if estadoSugerido == "Pagado" || montoPagado >= montoTotal {
		return "Pagado"
	}

	if estadoSugerido == "Pendiente" || estadoSugerido == "Parcial" || estadoSugerido == "Vencido" {
		now := time.Now()
		
		if montoPagado > 0 && montoPagado < montoTotal {
			if fechaVencimiento.Before(now) {
				return "Vencido"
			}
			return "Parcial"
		}
		
		if fechaVencimiento.Before(now) {
			return "Vencido"
		}
		
		return "Pendiente"
	}
	
	return estadoSugerido
}

// CrearPagosMensualesDelAnio generates all unpaid quotas for the year based on the contract
func CrearPagosMensualesDelAnio(db *gorm.DB, contrato models.Contrato, anio int) error {
    fechaInicioAnio := time.Date(anio, 1, 1, 0, 0, 0, 0, time.UTC)
    fechaFinAnio := time.Date(anio, 12, 31, 23, 59, 59, 0, time.UTC)
    
    // Adjust start date if contract starts later in the year
    if contrato.FechaInicio.After(fechaInicioAnio) {
        fechaInicioAnio = contrato.FechaInicio
    }
    
    // Adjust end date if contract ends early
    if contrato.FechaFin != nil && contrato.FechaFin.Before(fechaFinAnio) {
        fechaFinAnio = *contrato.FechaFin
    }

    mesInicio := int(fechaInicioAnio.Month())
    mesFin := int(fechaFinAnio.Month())

    for mes := mesInicio; mes <= mesFin; mes++ {
        montoAlquiler := contrato.MontoMensual
        if contrato.TipoContrato == "Anticretico" {
            montoAlquiler = 0
        }
        
        montoServicios := contrato.MontoServicios
        montoInternet := 0.0
        if contrato.IncluyeInternet {
            montoInternet = contrato.MontoInternet
        }
        
        montoTotal := montoAlquiler + montoServicios + montoInternet
        fechaVenc := CalcularFechaVencimiento(contrato.FechaInicio, mes, anio)
        
        pago := models.PagoMensual{
            ContratoID: contrato.ID,
            Anio: anio,
            Mes: mes,
            MontoAlquiler: montoAlquiler,
            MontoServicios: montoServicios,
            MontoInternet: montoInternet,
            MontoTotal: montoTotal,
            MontoPagado: 0,
            FechaVencimiento: fechaVenc,
            EstadoPago: "Pendiente",
        }
        
        // Use FirstOrCreate logic
        var count int64
        db.Model(&models.PagoMensual{}).Where("contrato_id = ? AND anio = ? AND mes = ?", contrato.ID, anio, mes).Count(&count)
        if count == 0 {
            if err := db.Create(&pago).Error; err != nil {
                return err
            }
        }
    }
    return nil
}
