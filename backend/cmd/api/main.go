package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/erick/pagosbolivar/internal/database"
	"github.com/erick/pagosbolivar/internal/handlers"
)

func main() {
	// Initialize database
	db, err := database.InitDB("pagos.db")
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

	// Start server
	log.Println("Server starting on :8080...")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
