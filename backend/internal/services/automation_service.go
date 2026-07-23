package services

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/erick/pagosbolivar/internal/models"
	"gorm.io/gorm"
)

type ESP32Data struct {
	Lm            string `json:"lm"`
	Lm2           string `json:"lm2"`
	CaudalEntrada string `json:"caudal_entrada"`
	CaudalSalida  string `json:"caudal_salida"`
	Balance       string `json:"balance"`
	Distancia     string `json:"distancia"`
	Nivel         string `json:"nivel"`
	Porcentaje    string `json:"porcentaje"`
}

type AutomationStatus struct {
	Connected   bool                      `json:"connected"`
	RelayState  string                    `json:"relay_state"`
	LastData    *ESP32Data                `json:"last_data"`
	LastUpdated string                    `json:"last_updated"`
	Settings    *models.AutomationSetting `json:"settings"`
}

type AutomationService struct {
	mu           sync.RWMutex
	db           *gorm.DB
	client       mqtt.Client
	connected    bool
	relayState   string
	lastData     *ESP32Data
	lastUpdated  time.Time
	brokerURL    string
	settings     *models.AutomationSetting
}

var (
	GlobalAutomationService *AutomationService
	once                    sync.Once
)

func GetAutomationService() *AutomationService {
	once.Do(func() {
		GlobalAutomationService = &AutomationService{
			relayState: "Desconocido",
			brokerURL:  "77.42.17.7:11884",
			settings: &models.AutomationSetting{
				Broker:           "77.42.17.7:11884",
				RelayCmdTopic:    "rele/cmd",
				RelayStateTopic:  "rele/state",
				TelemetryTopic:   "rele",
				KeyPorcentaje:    "porcentaje",
				KeyNivel:         "nivel",
				KeyDistancia:     "distancia",
				KeyCaudalEntrada: "caudal_entrada",
				KeyCaudalSalida:  "caudal_salida",
				KeyBalance:       "balance",
				KeyLm:            "lm",
				KeyLm2:           "lm2",
			},
		}
	})
	return GlobalAutomationService
}

func (s *AutomationService) SetDB(db *gorm.DB) {
	s.mu.Lock()
	s.db = db
	s.mu.Unlock()
	s.LoadSettings()
}

func (s *AutomationService) LoadSettings() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return
	}

	var settings models.AutomationSetting
	if err := s.db.First(&settings).Error; err != nil {
		// Create default settings if not exists
		settings = models.AutomationSetting{
			Broker:           "77.42.17.7:11884",
			RelayCmdTopic:    "rele/cmd",
			RelayStateTopic:  "rele/state",
			TelemetryTopic:   "rele",
			KeyPorcentaje:    "porcentaje",
			KeyNivel:         "nivel",
			KeyDistancia:     "distancia",
			KeyCaudalEntrada: "caudal_entrada",
			KeyCaudalSalida:  "caudal_salida",
			KeyBalance:       "balance",
			KeyLm:            "lm",
			KeyLm2:           "lm2",
		}
		s.db.Create(&settings)
	}
	s.settings = &settings
	s.brokerURL = settings.Broker
}

func (s *AutomationService) UpdateSettings(newSettings models.AutomationSetting) error {
	s.mu.RLock()
	db := s.db
	isConnected := s.connected
	s.mu.RUnlock()

	if db == nil {
		return fmt.Errorf("GORM DB connection not set in automation service")
	}

	newSettings.ID = 1 // Lock ID to 1 to have a single settings row
	if err := db.Save(&newSettings).Error; err != nil {
		return err
	}

	s.LoadSettings()

	// If connected, restart client with new broker configuration and new subscription topics
	if isConnected {
		s.Stop()
		s.Start(newSettings.Broker)
	}

	return nil
}

func (s *AutomationService) Start(broker string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.connected {
		return
	}

	s.brokerURL = broker
	opts := mqtt.NewClientOptions().AddBroker("tcp://" + broker)
	opts.SetClientID("bolivar_host_backend")
	opts.SetKeepAlive(60 * time.Second)
	opts.SetPingTimeout(10 * time.Second)
	opts.SetAutoReconnect(true)

	// Local pointers to settings topics for thread safety
	telemetryTopic := s.settings.TelemetryTopic
	stateTopic := s.settings.RelayStateTopic
	cmdTopic := s.settings.RelayCmdTopic

	opts.OnConnect = func(c mqtt.Client) {
		log.Printf("[MQTT] Connected to broker: %s\n", broker)
		s.mu.Lock()
		s.connected = true
		s.mu.Unlock()

		// Subscribe to telemetry topic
		if token := c.Subscribe(telemetryTopic, 1, s.handleSensorMessage); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error subscribing to telemetry topic %s: %v\n", telemetryTopic, token.Error())
		}
		
		// Subscribe to state topic
		if token := c.Subscribe(stateTopic, 1, s.handleStateMessage); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error subscribing to state topic %s: %v\n", stateTopic, token.Error())
		}

		// Request current state from ESP32
		c.Publish(cmdTopic, 1, false, "state")
	}

	opts.OnConnectionLost = func(c mqtt.Client, err error) {
		log.Printf("[MQTT] Connection lost: %v\n", err)
		s.mu.Lock()
		s.connected = false
		s.mu.Unlock()
	}

	s.client = mqtt.NewClient(opts)
	go func() {
		if token := s.client.Connect(); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error connecting to broker %s: %v\n", broker, token.Error())
		}
	}()
}

func (s *AutomationService) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client == nil {
		return
	}

	s.client.Disconnect(250)
	s.connected = false
	s.relayState = "Desconocido"
	log.Println("[MQTT] Disconnected from broker manually.")
}

func (s *AutomationService) SendCommand(cmd string) error {
	s.mu.RLock()
	client := s.client
	connected := s.connected
	broker := s.brokerURL
	cmdTopic := s.settings.RelayCmdTopic
	s.mu.RUnlock()

	if !connected || client == nil {
		opts := mqtt.NewClientOptions().AddBroker("tcp://" + broker)
		opts.SetClientID("bolivar_host_cmd_temp")
		c := mqtt.NewClient(opts)
		if token := c.Connect(); token.Wait() && token.Error() != nil {
			return fmt.Errorf("MQTT not connected and failed to establish temporary connection: %v", token.Error())
		}
		defer c.Disconnect(250)
		token := c.Publish(cmdTopic, 1, false, cmd)
		token.Wait()
		return token.Error()
	}

	token := client.Publish(cmdTopic, 1, false, cmd)
	token.Wait()
	return token.Error()
}

func (s *AutomationService) GetStatus() AutomationStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var lastUpdatedStr string
	if !s.lastUpdated.IsZero() {
		lastUpdatedStr = s.lastUpdated.Format(time.RFC3339)
	}

	return AutomationStatus{
		Connected:   s.connected,
		RelayState:  s.relayState,
		LastData:    s.lastData,
		LastUpdated: lastUpdatedStr,
		Settings:    s.settings,
	}
}

func getStringValue(m map[string]interface{}, key string) string {
	if key == "" {
		return "0"
	}
	v, exists := m[key]
	if !exists || v == nil {
		return "0"
	}
	switch val := v.(type) {
	case string:
		return val
	default:
		return fmt.Sprintf("%v", val)
	}
}

func (s *AutomationService) handleSensorMessage(client mqtt.Client, msg mqtt.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var rawMap map[string]interface{}
	if err := json.Unmarshal(msg.Payload(), &rawMap); err != nil {
		log.Printf("[MQTT] Failed to unmarshal rele payload: %v\n", err)
		return
	}

	// Load values dynamically based on current configuration keys
	data := ESP32Data{
		Lm:            getStringValue(rawMap, s.settings.KeyLm),
		Lm2:           getStringValue(rawMap, s.settings.KeyLm2),
		CaudalEntrada: getStringValue(rawMap, s.settings.KeyCaudalEntrada),
		CaudalSalida:  getStringValue(rawMap, s.settings.KeyCaudalSalida),
		Balance:       getStringValue(rawMap, s.settings.KeyBalance),
		Distancia:     getStringValue(rawMap, s.settings.KeyDistancia),
		Nivel:         getStringValue(rawMap, s.settings.KeyNivel),
		Porcentaje:    getStringValue(rawMap, s.settings.KeyPorcentaje),
	}

	s.lastData = &data
	s.lastUpdated = time.Now()
}

func (s *AutomationService) handleStateMessage(client mqtt.Client, msg mqtt.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.relayState = string(msg.Payload())
	s.lastUpdated = time.Now()
	log.Printf("[MQTT] Relay state updated to: %s\n", s.relayState)
}
