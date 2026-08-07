package services

import (
	"time"

	"github.com/erick/pagosbolivar/internal/models"
	"gorm.io/gorm"
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
			ContratoID:       contrato.ID,
			Anio:             anio,
			Mes:              mes,
			MontoAlquiler:    montoAlquiler,
			MontoServicios:   montoServicios,
			MontoInternet:    montoInternet,
			MontoTotal:       montoTotal,
			MontoPagado:      0,
			FechaVencimiento: fechaVenc,
			EstadoPago:       "Pendiente",
		}

		if err := db.Where(
			"contrato_id = ? AND anio = ? AND mes = ?",
			contrato.ID,
			anio,
			mes,
		).FirstOrCreate(&pago).Error; err != nil {
			return err
		}
	}
	return nil
}

func CrearOPagarMes(db *gorm.DB, contrato models.Contrato, anio int, mes int, montoPagado float64) (models.PagoMensual, error) {
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
		ContratoID:       contrato.ID,
		Anio:             anio,
		Mes:              mes,
		MontoAlquiler:    montoAlquiler,
		MontoServicios:   montoServicios,
		MontoInternet:    montoInternet,
		MontoTotal:       montoTotal,
		MontoPagado:      0,
		FechaVencimiento: fechaVenc,
		EstadoPago:       "Pendiente",
	}

	if err := db.Where(
		"contrato_id = ? AND anio = ? AND mes = ?",
		contrato.ID,
		anio,
		mes,
	).FirstOrCreate(&pago).Error; err != nil {
		return pago, err
	}

	pago.MontoAlquiler = montoAlquiler
	pago.MontoServicios = montoServicios
	pago.MontoInternet = montoInternet
	pago.MontoTotal = montoTotal
	pago.FechaVencimiento = fechaVenc
	pago.MontoPagado = montoPagado
	if montoPagado > 0 {
		now := time.Now()
		pago.FechaPago = &now
	}
	pago.EstadoPago = DeterminarEstadoPago("Pendiente", pago.FechaVencimiento, pago.MontoTotal, pago.MontoPagado)

	if err := db.Save(&pago).Error; err != nil {
		return pago, err
	}

	return pago, nil
}

func ActualizarVencimientosPagosNoCobrados(db *gorm.DB, contrato models.Contrato) error {
	var pagos []models.PagoMensual
	if err := db.Where(
		"contrato_id = ? AND estado_pago <> ?",
		contrato.ID,
		"Pagado",
	).Find(&pagos).Error; err != nil {
		return err
	}

	for i := range pagos {
		montoAlquiler := contrato.MontoMensual
		if contrato.TipoContrato == "Anticretico" {
			montoAlquiler = 0
		}
		montoInternet := 0.0
		if contrato.IncluyeInternet {
			montoInternet = contrato.MontoInternet
		}

		pagos[i].MontoAlquiler = montoAlquiler
		pagos[i].MontoServicios = contrato.MontoServicios
		pagos[i].MontoInternet = montoInternet
		pagos[i].MontoTotal = montoAlquiler + contrato.MontoServicios + montoInternet
		pagos[i].FechaVencimiento = CalcularFechaVencimiento(contrato.FechaInicio, pagos[i].Mes, pagos[i].Anio)
		pagos[i].EstadoPago = DeterminarEstadoPago(pagos[i].EstadoPago, pagos[i].FechaVencimiento, pagos[i].MontoTotal, pagos[i].MontoPagado)
		if err := db.Save(&pagos[i]).Error; err != nil {
			return err
		}
	}

	return nil
}
