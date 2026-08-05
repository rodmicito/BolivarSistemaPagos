package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/erick/pagosbolivar/internal/models"
	"github.com/erick/pagosbolivar/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRoutes(r *gin.Engine, db *gorm.DB) {
	api := r.Group("/api")

	// === DASHBOARD STATS ===
	api.GET("/dashboard/stats", func(c *gin.Context) {
		var totalHabitaciones int64
		var contratosActivos int64

		// Total habitaciones
		db.Model(&models.Habitacion{}).Count(&totalHabitaciones)

		// Contratos activos
		db.Model(&models.Contrato{}).Where("estado = ?", "Activo").Count(&contratosActivos)

		ocupadas := contratosActivos
		disponibles := totalHabitaciones - ocupadas

		c.JSON(http.StatusOK, gin.H{
			"total_habitaciones": totalHabitaciones,
			"ocupadas":           ocupadas,
			"disponibles":        disponibles,
			"contratos_activos":  contratosActivos,
		})
	})

	// === HABITACIONES ===
	api.GET("/habitaciones", func(c *gin.Context) {
		var habitaciones []models.Habitacion
		db.Find(&habitaciones)
		c.JSON(http.StatusOK, habitaciones)
	})

	api.POST("/habitaciones", func(c *gin.Context) {
		var h models.Habitacion
		if err := c.ShouldBindJSON(&h); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		h.Numero = strings.TrimSpace(h.Numero)
		if h.Numero == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Debe indicar el numero de habitacion"})
			return
		}
		if _, exists, err := services.FindHabitacionByNumero(db, h.Numero, 0); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate habitacion"})
			return
		} else if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "Ya existe una habitacion con ese numero"})
			return
		}

		if err := db.Create(&h).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create habitacion"})
			return
		}
		c.JSON(http.StatusCreated, h)
	})

	api.PUT("/habitaciones/:id", func(c *gin.Context) {
		id := c.Param("id")
		var h models.Habitacion
		if err := db.First(&h, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Habitacion not found"})
			return
		}

		var updateData models.Habitacion
		if err := c.ShouldBindJSON(&updateData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		updateData.Numero = strings.TrimSpace(updateData.Numero)
		if updateData.Numero == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Debe indicar el numero de habitacion"})
			return
		}
		if _, exists, err := services.FindHabitacionByNumero(db, updateData.Numero, h.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate habitacion"})
			return
		} else if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "Ya existe otra habitacion con ese numero"})
			return
		}

		// Update fields
		h.Numero = updateData.Numero
		h.Bloque = updateData.Bloque
		h.Nivel = updateData.Nivel
		h.TipoHabitacion = updateData.TipoHabitacion
		h.TipoBano = updateData.TipoBano
		h.Descripcion = updateData.Descripcion
		h.PrecioAlquiler = updateData.PrecioAlquiler
		h.PrecioAnticretico = updateData.PrecioAnticretico
		h.PrecioInternet = updateData.PrecioInternet

		db.Save(&h)
		c.JSON(http.StatusOK, h)
	})

	// === CONTRATOS ===
	api.GET("/contratos", func(c *gin.Context) {
		var contratos []models.Contrato
		db.Preload("Habitacion").Preload("Inquilino").Find(&contratos)
		services.SyncContratosInquilinoNombre(contratos)
		c.JSON(http.StatusOK, contratos)
	})

	api.POST("/contratos", func(c *gin.Context) {
		var ct models.Contrato
		if err := c.ShouldBindJSON(&ct); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		inquilino, err := services.FindOrCreateInquilino(db, ct.Inquilino, ct.InquilinoNombre)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Debe indicar un inquilino valido"})
			return
		}

		ct.InquilinoID = inquilino.ID
		ct.Estado = "Activo"
		if ct.FechaInicio.IsZero() {
			ct.FechaInicio = time.Now()
		}

		if exists, err := services.HasActiveContratoForHabitacion(db, ct.HabitacionID, 0); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate habitacion contract"})
			return
		} else if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "La habitacion ya tiene un contrato activo"})
			return
		}
		if exists, err := services.HasActiveContratoForInquilino(db, ct.InquilinoID, 0); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate inquilino contract"})
			return
		} else if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "El inquilino ya tiene un contrato activo"})
			return
		}

		if err := db.Create(&ct).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create contrato"})
			return
		}

		// Generate monthly payments
		services.CrearPagosMensualesDelAnio(db, ct, time.Now().Year())

		db.Preload("Habitacion").Preload("Inquilino").First(&ct, ct.ID)
		services.SyncContratoInquilinoNombre(&ct)
		c.JSON(http.StatusCreated, ct)
	})

	api.PUT("/contratos/:id", func(c *gin.Context) {
		id := c.Param("id")
		var ct models.Contrato
		if err := db.First(&ct, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Contrato not found"})
			return
		}

		var updateData models.Contrato
		if err := c.ShouldBindJSON(&updateData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		inquilino, err := services.FindOrCreateInquilino(db, updateData.Inquilino, updateData.InquilinoNombre)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Debe indicar un inquilino valido"})
			return
		}

		ct.InquilinoID = inquilino.ID
		if updateData.HabitacionID != 0 {
			ct.HabitacionID = updateData.HabitacionID
		}
		ct.Estado = updateData.Estado
		ct.TipoContrato = updateData.TipoContrato
		ct.MontoMensual = updateData.MontoMensual
		ct.MontoGarantia = updateData.MontoGarantia
		if !updateData.FechaInicio.IsZero() {
			ct.FechaInicio = updateData.FechaInicio
		}

		if ct.Estado == "Activo" {
			if exists, err := services.HasActiveContratoForHabitacion(db, ct.HabitacionID, ct.ID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate habitacion contract"})
				return
			} else if exists {
				c.JSON(http.StatusConflict, gin.H{"error": "La habitacion ya tiene otro contrato activo"})
				return
			}
			if exists, err := services.HasActiveContratoForInquilino(db, ct.InquilinoID, ct.ID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate inquilino contract"})
				return
			} else if exists {
				c.JSON(http.StatusConflict, gin.H{"error": "El inquilino ya tiene otro contrato activo"})
				return
			}
		}

		if err := db.Save(&ct).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update contrato"})
			return
		}
		if err := services.ActualizarVencimientosPagosNoCobrados(db, ct); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update payment due dates"})
			return
		}
		db.Preload("Habitacion").Preload("Inquilino").First(&ct, ct.ID)
		services.SyncContratoInquilinoNombre(&ct)
		c.JSON(http.StatusOK, ct)
	})

	// === INQUILINOS ===
	api.GET("/inquilinos", func(c *gin.Context) {
		var inquilinos []models.Inquilino
		db.Order("nombre asc").Find(&inquilinos)
		c.JSON(http.StatusOK, inquilinos)
	})

	api.POST("/inquilinos", func(c *gin.Context) {
		var inquilino models.Inquilino
		if err := c.ShouldBindJSON(&inquilino); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		created, err := services.FindOrCreateInquilino(db, inquilino, inquilino.Nombre)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Debe indicar un nombre de inquilino"})
			return
		}

		c.JSON(http.StatusCreated, created)
	})

	api.PUT("/inquilinos/:id", func(c *gin.Context) {
		id := c.Param("id")
		var inquilino models.Inquilino
		if err := db.First(&inquilino, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Inquilino not found"})
			return
		}

		var updateData models.Inquilino
		if err := c.ShouldBindJSON(&updateData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		inquilino.Nombre = updateData.Nombre
		inquilino.Documento = updateData.Documento
		inquilino.Telefono = updateData.Telefono
		inquilino.Email = updateData.Email
		inquilino.Observaciones = updateData.Observaciones
		inquilino.Activo = updateData.Activo

		if err := db.Save(&inquilino).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update inquilino"})
			return
		}

		c.JSON(http.StatusOK, inquilino)
	})

	api.DELETE("/contratos/:id", func(c *gin.Context) {
		id := c.Param("id")

		// Use a transaction to ensure both payments and contract are deleted
		err := db.Transaction(func(tx *gorm.DB) error {
			// 1. Delete associated payments
			if err := tx.Where("contrato_id = ?", id).Delete(&models.PagoMensual{}).Error; err != nil {
				return err
			}
			// 2. Delete the contract itself
			if err := tx.Delete(&models.Contrato{}, id).Error; err != nil {
				return err
			}
			return nil
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete contrato and associated payments"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Contrato deleted successfully"})
	})

	// === PAGOS ===
	api.GET("/pagos", func(c *gin.Context) {
		var pagos []models.PagoMensual
		db.Preload("Contrato.Habitacion").Preload("Contrato.Inquilino").Find(&pagos)
		for i := range pagos {
			services.SyncContratoInquilinoNombre(&pagos[i].Contrato)
		}
		c.JSON(http.StatusOK, pagos)
	})

	// Quick pay
	api.POST("/pagos/:id/pagar", func(c *gin.Context) {
		id := c.Param("id")
		var pago models.PagoMensual

		if err := db.First(&pago, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pago not found"})
			return
		}

		now := time.Now()
		pago.FechaPago = &now
		pago.MontoPagado = pago.MontoTotal
		pago.EstadoPago = "Pagado"

		db.Save(&pago)
		c.JSON(http.StatusOK, pago)
	})

	// === AUTOMATION ===
	api.GET("/automation/status", func(c *gin.Context) {
		status := services.GetAutomationService().GetStatus()
		c.JSON(http.StatusOK, status)
	})

	api.POST("/automation/connect", func(c *gin.Context) {
		var req struct {
			Broker  string `json:"broker"`
			Connect bool   `json:"connect"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		service := services.GetAutomationService()
		if req.Connect {
			if req.Broker == "" {
				status := service.GetStatus()
				if status.Settings != nil {
					req.Broker = status.Settings.Broker
				}
			}
			service.Start(req.Broker)
		} else {
			service.Stop()
		}

		c.JSON(http.StatusOK, service.GetStatus())
	})

	api.POST("/automation/command", func(c *gin.Context) {
		var req struct {
			Command string `json:"command"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		service := services.GetAutomationService()
		if err := service.SendCommand(req.Command); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Command sent successfully"})
	})

	api.POST("/automation/settings", func(c *gin.Context) {
		var req models.AutomationSetting
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		service := services.GetAutomationService()
		if err := service.UpdateSettings(req); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, service.GetStatus())
	})

	api.POST("/automation/timer/start", func(c *gin.Context) {
		var req struct {
			Minutes int `json:"minutes"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if req.Minutes <= 0 {
			req.Minutes = 10
		}

		service := services.GetAutomationService()
		if err := service.StartAutoOffTimer(req.Minutes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, service.GetStatus())
	})

	api.POST("/automation/timer/stop", func(c *gin.Context) {
		service := services.GetAutomationService()
		if err := service.StopAutoOffTimer(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, service.GetStatus())
	})

	api.GET("/automation/logs", func(c *gin.Context) {
		service := services.GetAutomationService()
		db := service.GetDB()
		if db == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not initialized"})
			return
		}

		limitStr := c.DefaultQuery("limit", "10")
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			limit = 10
		}
		if limit > 1000 {
			limit = 1000
		}

		var logs []models.TelemetryLog
		if err := db.Order("timestamp desc").Limit(limit).Find(&logs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, logs)
	})
}
