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
}
