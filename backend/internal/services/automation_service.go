package services

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
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
	Connected   bool       `json:"connected"`
	RelayState  string     `json:"relay_state"`
	LastData    *ESP32Data `json:"last_data"`
	LastUpdated string     `json:"last_updated"`
}

type AutomationService struct {
	mu           sync.RWMutex
	client       mqtt.Client
	connected    bool
	relayState   string
	lastData     *ESP32Data
	lastUpdated  time.Time
	brokerURL    string
}

var (
	GlobalAutomationService *AutomationService
	once                    sync.Once
)

func GetAutomationService() *AutomationService {
	once.Do(func() {
		GlobalAutomationService = &AutomationService{
			relayState: "Desconocido",
			brokerURL:  "77.42.17.7:11884", // Default broker from MQTT_CONTROL_RELE.md
		}
	})
	return GlobalAutomationService
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

	opts.OnConnect = func(c mqtt.Client) {
		log.Printf("[MQTT] Connected to broker: %s\n", broker)
		s.mu.Lock()
		s.connected = true
		s.mu.Unlock()

		// Subscribe to topics
		if token := c.Subscribe("rele", 1, s.handleSensorMessage); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error subscribing to topic rele: %v\n", token.Error())
		}
		if token := c.Subscribe("rele/state", 1, s.handleStateMessage); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error subscribing to topic rele/state: %v\n", token.Error())
		}

		// Ask ESP32 to publish its state
		c.Publish("rele/cmd", 1, false, "state")
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
	s.mu.RUnlock()

	if !connected || client == nil {
		// Try to send command by creating a temporary client
		opts := mqtt.NewClientOptions().AddBroker("tcp://" + broker)
		opts.SetClientID("bolivar_host_cmd_temp")
		c := mqtt.NewClient(opts)
		if token := c.Connect(); token.Wait() && token.Error() != nil {
			return fmt.Errorf("MQTT not connected and failed to establish temporary connection: %v", token.Error())
		}
		defer c.Disconnect(250)
		token := c.Publish("rele/cmd", 1, false, cmd)
		token.Wait()
		return token.Error()
	}

	token := client.Publish("rele/cmd", 1, false, cmd)
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
	}
}

func (s *AutomationService) handleSensorMessage(client mqtt.Client, msg mqtt.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var data ESP32Data
	if err := json.Unmarshal(msg.Payload(), &data); err != nil {
		log.Printf("[MQTT] Failed to unmarshal rele payload: %v\n", err)
		// Check if it's a simple string or single value
		return
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
