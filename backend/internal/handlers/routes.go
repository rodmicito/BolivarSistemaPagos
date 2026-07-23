package handlers

import (
	"net/http"
    "time"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"github.com/erick/pagosbolivar/internal/models"
    "github.com/erick/pagosbolivar/internal/services"
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
            "ocupadas": ocupadas,
            "disponibles": disponibles,
            "contratos_activos": contratosActivos,
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
        db.Create(&h)
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
		db.Preload("Habitacion").Find(&contratos)
		c.JSON(http.StatusOK, contratos)
	})
    
    api.POST("/contratos", func(c *gin.Context) {
        var ct models.Contrato
        if err := c.ShouldBindJSON(&ct); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        
        ct.Estado = "Activo"
        if err := db.Create(&ct).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create contrato"})
            return
        }
        
        // Generate monthly payments
        services.CrearPagosMensualesDelAnio(db, ct, time.Now().Year())
        
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

        // Update fields related to Inquilino/Contrato
        ct.InquilinoNombre = updateData.InquilinoNombre
        ct.Estado = updateData.Estado
        ct.TipoContrato = updateData.TipoContrato
        ct.MontoMensual = updateData.MontoMensual
        ct.MontoGarantia = updateData.MontoGarantia

        db.Save(&ct)
        c.JSON(http.StatusOK, ct)
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
		db.Preload("Contrato.Habitacion").Find(&pagos)
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
                req.Broker = "77.42.17.7:11884"
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

    api.PUT("/automation/settings", func(c *gin.Context) {
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
}
