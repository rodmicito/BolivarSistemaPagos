package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/erick/pagosbolivar/internal/database"
	"github.com/erick/pagosbolivar/internal/handlers"
)

func main() {
	// Initialize database
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "pagos.db"
	}
	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Error initializing database: %v", err)
	}

	// Create Gin router
	r := gin.Default()

	// Setup CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true // In production, restrict this
	r.Use(cors.New(config))

	// Setup Routes
	handlers.SetupRoutes(r, db)

	// Serve static files if dist directory exists (production container build)
	if _, err := os.Stat("dist"); err == nil {
		r.StaticFS("/assets", http.Dir("dist/assets"))
		r.StaticFile("/favicon.ico", "dist/favicon.ico")
		r.StaticFile("/", "dist/index.html")
		r.NoRoute(func(c *gin.Context) {
			// Do not fallback to index.html for API requests
			if len(c.Request.URL.Path) >= 5 && c.Request.URL.Path[:5] == "/api/" {
				c.JSON(http.StatusNotFound, gin.H{"error": "Not Found"})
				return
			}
			c.File("dist/index.html")
		})
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server starting on :%s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
