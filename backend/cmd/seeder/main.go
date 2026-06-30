package main

import (
	"log"
	"time"

	"github.com/erick/pagosbolivar/internal/database"
	"github.com/erick/pagosbolivar/internal/models"
	"github.com/erick/pagosbolivar/internal/services"
)

func main() {
	db, err := database.InitDB("pagos.db")
	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	// Create Room
	habitacion := models.Habitacion{
		Numero:      "A-101",
		Bloque:      "A",
		Descripcion: "Habitación principal",
	}
	db.FirstOrCreate(&habitacion, models.Habitacion{Numero: "A-101"})
	log.Println("Habitación creada:", habitacion.ID)

	// Create Contract
	ahora := time.Now()
	inicioAnio := time.Date(ahora.Year(), 1, 5, 0, 0, 0, 0, time.UTC)
	
	contrato := models.Contrato{
		HabitacionID:    habitacion.ID,
		InquilinoNombre: "Juan Perez",
		TipoContrato:    "Alquiler",
		MontoMensual:    1500,
		MontoServicios:  50,
		IncluyeInternet: true,
		MontoInternet:   100,
		MontoGarantia:   1500,
		FechaInicio:     inicioAnio,
		Estado:          "Activo",
	}
	db.FirstOrCreate(&contrato, models.Contrato{InquilinoNombre: "Juan Perez"})
	log.Println("Contrato creado:", contrato.ID)

	// Create Payments
	err = services.CrearPagosMensualesDelAnio(db, contrato, ahora.Year())
	if err != nil {
		log.Fatalf("Error creando pagos: %v", err)
	}
	log.Println("Pagos mensuales generados con éxito.")

	// Set one payment to Paid to see stats
	var pago models.PagoMensual
	db.Where("contrato_id = ? AND mes = ?", contrato.ID, ahora.Month()).First(&pago)
	if pago.ID != 0 {
		pago.EstadoPago = "Pagado"
		pago.MontoPagado = pago.MontoTotal
		pago.FechaPago = &ahora
		db.Save(&pago)
		log.Println("Pago del mes actual marcado como Pagado.")
	}
}
