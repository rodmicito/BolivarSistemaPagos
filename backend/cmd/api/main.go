package main

import (
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/erick/pagosbolivar/internal/database"
	"github.com/erick/pagosbolivar/internal/handlers"
	"github.com/erick/pagosbolivar/internal/models"
)

func main() {
	// Initialize database
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "pagos.db"
	}

	// Copy default database if the destination database file doesn't exist
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		if _, errDefault := os.Stat("pagos_default.db"); errDefault == nil {
			log.Printf("Database file not found at %s. Copying default database pagos_default.db...", dbPath)
			// Ensure parent directory exists
			dir := filepath.Dir(dbPath)
			if errDir := os.MkdirAll(dir, 0755); errDir != nil {
				log.Printf("Failed to create directory %s: %v", dir, errDir)
			} else {
				src, errSrc := os.Open("pagos_default.db")
				if errSrc == nil {
					defer src.Close()
					dst, errDst := os.Create(dbPath)
					if errDst == nil {
						defer dst.Close()
						if _, errCopy := io.Copy(dst, src); errCopy != nil {
							log.Printf("Failed to copy default database: %v", errCopy)
						} else {
							log.Println("Default database copied successfully.")
						}
					} else {
						log.Printf("Failed to create destination database file: %v", errDst)
					}
				} else {
					log.Printf("Failed to open source default database: %v", errSrc)
				}
			}
		}
	}

	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Error initializing database: %v", err)
	}

	// Check if the database has 0 rooms, which indicates an empty/freshly initialized DB,
	// and copy the pre-seeded default database if it is available.
	var count int64
	if errCount := db.Model(&models.Habitacion{}).Count(&count).Error; errCount == nil && count == 0 {
		if _, errDefault := os.Stat("pagos_default.db"); errDefault == nil {
			log.Println("Database has 0 rooms. Restoring default database from pagos_default.db...")
			
			// Close GORM connection to release file lock on SQLite database
			sqlDB, errSql := db.DB()
			if errSql == nil {
				sqlDB.Close()
			}
			
			// Copy pagos_default.db over dbPath
			src, errSrc := os.Open("pagos_default.db")
			if errSrc == nil {
				defer src.Close()
				dst, errDst := os.Create(dbPath)
				if errDst == nil {
					defer dst.Close()
					if _, errCopy := io.Copy(dst, src); errCopy != nil {
						log.Printf("Failed to copy default database: %v", errCopy)
					} else {
						log.Println("Default database restored successfully.")
					}
				} else {
					log.Printf("Failed to create destination database file: %v", errDst)
				}
			} else {
				log.Printf("Failed to open source default database: %v", errSrc)
			}
			
			// Reconnect to the newly copied database
			db, err = database.InitDB(dbPath)
			if err != nil {
				log.Fatalf("Error re-initializing database after restore: %v", err)
			}
		}
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
