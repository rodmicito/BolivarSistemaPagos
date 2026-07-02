package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/erick/pagosbolivar/internal/database"
	"github.com/erick/pagosbolivar/internal/models"
)

type RoomJSON struct {
	ID                uint        `json:"id"`
	Numero            interface{} `json:"numero"`
	Bloque            string      `json:"bloque"`
	Nivel             string      `json:"nivel"`
	TipoHabitacion    string      `json:"tipo_habitacion"`
	TipoBano          string      `json:"tipo_bano"`
	PrecioAlquiler    string      `json:"precio_alquiler"`
	PrecioAnticretico string      `json:"precio_anticretico"`
	PrecioInternet    string      `json:"precio_internet"`
	Descripcion       string      `json:"descripcion"`
	Disponible        bool        `json:"disponible"`
	Activo            bool        `json:"activo"`
}

func main() {
	database.ConnectDB()

	// Wipe old rooms just in case
	database.DB.Exec("DELETE FROM habitacions")

	data, err := os.ReadFile("rooms.json")
	if err != nil {
		log.Fatalf("Error reading rooms.json: %v", err)
	}

	var rooms []RoomJSON
	if err := json.Unmarshal(data, &rooms); err != nil {
		log.Fatalf("Error unmarshalling json: %v", err)
	}

	for _, r := range rooms {
		alquiler, _ := strconv.ParseFloat(r.PrecioAlquiler, 64)
		anticretico, _ := strconv.ParseFloat(r.PrecioAnticretico, 64)
		internet, _ := strconv.ParseFloat(r.PrecioInternet, 64)

		numero := ""
		switch v := r.Numero.(type) {
		case string:
			numero = v
		case float64:
			numero = fmt.Sprintf("%.0f", v)
		}

		habitacion := models.Habitacion{
			ID:                r.ID,
			Numero:            numero,
			Bloque:            r.Bloque,
			Nivel:             r.Nivel,
			TipoHabitacion:    r.TipoHabitacion,
			TipoBano:          r.TipoBano,
			PrecioAlquiler:    alquiler,
			PrecioAnticretico: anticretico,
			PrecioInternet:    internet,
			Descripcion:       r.Descripcion,
			Disponible:        r.Disponible,
			Activo:            r.Activo,
		}

		if err := database.DB.Create(&habitacion).Error; err != nil {
			log.Printf("Error creating room %s: %v", numero, err)
		}
	}

	fmt.Println("Migrated", len(rooms), "rooms successfully!")
}
