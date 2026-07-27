package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
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
	Connected      bool                      `json:"connected"`
	RelayState     string                    `json:"relay_state"`
	RelayStateTime string                    `json:"relay_state_time"`
	LastData       *ESP32Data                `json:"last_data"`
	LastUpdated    string                    `json:"last_updated"`
	Settings       *models.AutomationSetting `json:"settings"`
	RawJSON        string                    `json:"raw_json"`
	RawCmd         string                    `json:"raw_cmd"`
	RawState       string                    `json:"raw_state"`
	AutoOffActive  bool                      `json:"auto_off_active"`
	AutoOffTarget  string                    `json:"auto_off_target"`
}

type AutomationService struct {
	mu              sync.RWMutex
	db              *gorm.DB
	client          mqtt.Client
	connected       bool
	relayState      string
	relayStateTime  time.Time
	lastData        *ESP32Data
	lastUpdated     time.Time
	brokerURL       string
	settings        *models.AutomationSetting
	rawJSON         string
	rawCmd          string
	rawState        string
	lastDbLogTime   time.Time
	autoOffActive   bool
	autoOffTarget   time.Time
	connectionError string

	schedulerTargetState    string
	schedulerTargetSince    time.Time
	lastSchedulerStateCheck time.Time
	lastSchedulerCorrection time.Time
}

var (
	GlobalAutomationService *AutomationService
	once                    sync.Once
)

func GetAutomationService() *AutomationService {
	once.Do(func() {
		defaultSettings := defaultAutomationSetting()
		GlobalAutomationService = &AutomationService{
			relayState:     "Desconocido",
			relayStateTime: time.Now(),
			brokerURL:      defaultSettings.Broker,
			settings:       &defaultSettings,
		}
		// Start cyclic scheduler loop in background
		go GlobalAutomationService.runSchedulerLoop()
		// Start database telemetry logging loop in background
		go GlobalAutomationService.runDbLoggingLoop()
	})
	return GlobalAutomationService
}

func (s *AutomationService) SetDB(db *gorm.DB) {
	s.mu.Lock()
	s.db = db
	s.mu.Unlock()
	s.LoadSettings()
}

func (s *AutomationService) GetDB() *gorm.DB {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.db
}

func (s *AutomationService) LoadSettings() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return
	}

	var settings models.AutomationSetting
	if err := s.db.First(&settings).Error; err != nil {
		settings = defaultAutomationSetting()
		s.db.Create(&settings)
	} else {
		defaultSettings := defaultAutomationSetting()
		// Auto-migrate old defaults on existing databases to the new targets
		updated := false
		if settings.Broker == "" {
			settings.Broker = defaultSettings.Broker
			updated = true
		}
		if settings.RelayCmdTopic == "rele/cmd" {
			settings.RelayCmdTopic = defaultSettings.RelayCmdTopic
			updated = true
		}
		if settings.TelemetryTopic == "rele" {
			settings.TelemetryTopic = defaultSettings.TelemetryTopic
			updated = true
		}
		if settings.TimeOn == 0 {
			settings.TimeOn = 15
			updated = true
		}
		if settings.TimeOff == 0 {
			settings.TimeOff = 45
			updated = true
		}
		if settings.DbLogInterval == 0 {
			settings.DbLogInterval = 5
			updated = true
		}
		if settings.AutoOffDuration == 0 {
			settings.AutoOffDuration = 10
			updated = true
		}
		if settings.DbLogRetentionDays == 0 {
			settings.DbLogRetentionDays = 7
			updated = true
		}
		if updated {
			s.db.Save(&settings)
		}
	}
	s.settings = &settings
	s.brokerURL = settings.Broker
}

func (s *AutomationService) UpdateSettings(newSettings models.AutomationSetting) error {
	s.mu.RLock()
	db := s.db
	isConnected := s.connected
	wasSchedulerActive := s.settings != nil && s.settings.SchedulerActive
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

	if newSettings.SchedulerActive && !wasSchedulerActive {
		go s.startSchedulerCycle()
	} else if !newSettings.SchedulerActive && wasSchedulerActive {
		s.stopSchedulerCycle()
	}

	return nil
}

func (s *AutomationService) startSchedulerCycle() {
	now := time.Now()
	s.mu.Lock()
	s.schedulerTargetState = "ON"
	s.schedulerTargetSince = now
	s.lastSchedulerStateCheck = time.Time{}
	s.lastSchedulerCorrection = time.Time{}
	s.relayState = "ON"
	s.relayStateTime = now
	s.mu.Unlock()

	log.Println("[SCHEDULER] Starting cycle in ON phase.")
	if err := s.SendCommand("on"); err != nil {
		log.Printf("[SCHEDULER] Error starting ON phase: %v\n", err)
		return
	}
	_ = s.SendCommand("state")
}

func (s *AutomationService) stopSchedulerCycle() {
	s.mu.Lock()
	s.schedulerTargetState = ""
	s.schedulerTargetSince = time.Time{}
	s.lastSchedulerStateCheck = time.Time{}
	s.lastSchedulerCorrection = time.Time{}
	s.mu.Unlock()
}

func (s *AutomationService) Start(broker string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.connected {
		return
	}

	if s.client != nil {
		s.client.Disconnect(250)
	}

	brokerURL := normalizeBrokerURL(broker)
	s.brokerURL = stripBrokerScheme(brokerURL)
	opts := mqtt.NewClientOptions().AddBroker(brokerURL)
	opts.SetClientID(mqttClientID("bolivar_host_backend"))
	opts.SetKeepAlive(60 * time.Second)
	opts.SetPingTimeout(10 * time.Second)
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)
	opts.SetResumeSubs(true)
	opts.SetConnectionLostHandler(func(c mqtt.Client, err error) {
		log.Printf("[MQTT] Connection lost: %v\n", err)
		s.mu.Lock()
		s.connected = false
		s.connectionError = err.Error()
		s.mu.Unlock()
	})

	// Local pointers to settings topics for thread safety
	telemetryTopic := s.settings.TelemetryTopic
	stateTopic := s.settings.RelayStateTopic
	cmdTopic := s.settings.RelayCmdTopic

	opts.OnConnect = func(c mqtt.Client) {
		log.Printf("[MQTT] Connected to broker: %s\n", brokerURL)
		s.mu.Lock()
		s.connected = true
		s.connectionError = ""
		s.mu.Unlock()

		// Subscribe to telemetry topic
		if token := c.Subscribe(telemetryTopic, 1, s.handleSensorMessage); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error subscribing to telemetry topic %s: %v\n", telemetryTopic, token.Error())
		}

		// Subscribe to state topic
		if token := c.Subscribe(stateTopic, 1, s.handleStateMessage); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error subscribing to state topic %s: %v\n", stateTopic, token.Error())
		}

		// Subscribe to command topic to monitor commands
		if token := c.Subscribe(cmdTopic, 1, s.handleCmdMessage); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error subscribing to command topic %s: %v\n", cmdTopic, token.Error())
		}

		// Request current state from ESP32
		c.Publish(cmdTopic, 1, false, "state")
	}

	s.client = mqtt.NewClient(opts)
	go func() {
		if token := s.client.Connect(); token.Wait() && token.Error() != nil {
			log.Printf("[MQTT] Error connecting to broker %s: %v\n", brokerURL, token.Error())
			s.mu.Lock()
			s.connected = false
			s.connectionError = token.Error().Error()
			s.mu.Unlock()
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
	s.mu.Lock()
	s.rawCmd = cmd
	s.mu.Unlock()

	s.mu.RLock()
	client := s.client
	connected := s.connected
	broker := s.brokerURL
	cmdTopic := s.settings.RelayCmdTopic
	s.mu.RUnlock()

	if !connected || client == nil {
		opts := mqtt.NewClientOptions().AddBroker(normalizeBrokerURL(broker))
		opts.SetClientID(mqttClientID("bolivar_host_cmd_temp"))
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

	var stateTimeStr string
	if !s.relayStateTime.IsZero() {
		stateTimeStr = s.relayStateTime.Format(time.RFC3339)
	}

	var autoOffTargetStr string
	if !s.autoOffTarget.IsZero() {
		autoOffTargetStr = s.autoOffTarget.Format(time.RFC3339)
	}

	return AutomationStatus{
		Connected:      s.connected,
		RelayState:     s.relayState,
		RelayStateTime: stateTimeStr,
		LastData:       s.lastData,
		LastUpdated:    lastUpdatedStr,
		Settings:       s.settings,
		RawJSON:        s.rawJSON,
		RawCmd:         s.rawCmd,
		RawState:       s.rawState,
		AutoOffActive:  s.autoOffActive,
		AutoOffTarget:  autoOffTargetStr,
	}
}

func defaultAutomationSetting() models.AutomationSetting {
	return models.AutomationSetting{
		Broker:             envOrDefault("MQTT_BROKER", "77.42.17.7:11884"),
		RelayCmdTopic:      envOrDefault("MQTT_RELAY_CMD_TOPIC", "nivelPrueba/cmd"),
		RelayStateTopic:    envOrDefault("MQTT_RELAY_STATE_TOPIC", "rele/state"),
		TelemetryTopic:     envOrDefault("MQTT_TELEMETRY_TOPIC", "nP1"),
		KeyPorcentaje:      envOrDefault("MQTT_KEY_PORCENTAJE", "porcentaje"),
		KeyNivel:           envOrDefault("MQTT_KEY_NIVEL", "nivel"),
		KeyDistancia:       envOrDefault("MQTT_KEY_DISTANCIA", "distancia"),
		KeyCaudalEntrada:   envOrDefault("MQTT_KEY_CAUDAL_ENTRADA", "caudal_entrada"),
		KeyCaudalSalida:    envOrDefault("MQTT_KEY_CAUDAL_SALIDA", "caudal_salida"),
		KeyBalance:         envOrDefault("MQTT_KEY_BALANCE", "balance"),
		KeyLm:              envOrDefault("MQTT_KEY_LM", "lm"),
		KeyLm2:             envOrDefault("MQTT_KEY_LM2", "lm2"),
		SchedulerActive:    false,
		TimeOn:             15,
		TimeOff:            45,
		DbLogActive:        false,
		DbLogInterval:      5,
		AutoOffDuration:    10,
		DbLogRetentionDays: 7,
	}
}

func envOrDefault(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func normalizeBrokerURL(broker string) string {
	broker = strings.TrimSpace(broker)
	if broker == "" {
		broker = defaultAutomationSetting().Broker
	}
	if strings.Contains(broker, "://") {
		return broker
	}
	return "tcp://" + broker
}

func stripBrokerScheme(broker string) string {
	parsed, err := url.Parse(broker)
	if err != nil || parsed.Host == "" {
		return strings.TrimPrefix(broker, "tcp://")
	}
	return parsed.Host
}

func mqttClientID(prefix string) string {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%s", prefix, sanitizeMQTTClientID(hostname))
}

func sanitizeMQTTClientID(value string) string {
	replacer := strings.NewReplacer(" ", "_", "/", "_", "\\", "_", ":", "_")
	return replacer.Replace(value)
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

	payloadStr := string(msg.Payload())
	s.rawJSON = payloadStr

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

	rawPayload := strings.TrimSpace(string(msg.Payload()))
	s.rawState = rawPayload

	// Normalize payload to uppercase ON or OFF
	upperPayload := strings.ToUpper(rawPayload)
	var normalizedState string
	if upperPayload == "ON" || upperPayload == "1" || upperPayload == "TRUE" {
		normalizedState = "ON"
	} else if upperPayload == "OFF" || upperPayload == "0" || upperPayload == "FALSE" {
		normalizedState = "OFF"
	} else {
		normalizedState = upperPayload
	}

	if s.relayState != normalizedState {
		s.relayState = normalizedState
		s.relayStateTime = time.Now()
	}
	s.lastUpdated = time.Now()
	log.Printf("[MQTT] Relay state updated to: %s (raw: %s)\n", s.relayState, rawPayload)
}

func (s *AutomationService) handleCmdMessage(client mqtt.Client, msg mqtt.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.rawCmd = string(msg.Payload())
	s.lastUpdated = time.Now()
	log.Printf("[MQTT] Relay command received: %s\n", s.rawCmd)
}

func (s *AutomationService) runSchedulerLoop() {
	ticker := time.NewTicker(5 * time.Second) // Check every 5 seconds for responsive schedules
	for range ticker.C {
		now := time.Now()
		var commandToSend string
		shouldRequestState := false

		s.mu.Lock()
		db := s.db
		if db == nil || s.settings == nil {
			s.mu.Unlock()
			continue
		}

		// Check one-shot auto-off timer expiration first (independent of scheduler)
		autoOffActive := s.autoOffActive
		autoOffTarget := s.autoOffTarget
		if autoOffActive && !autoOffTarget.IsZero() {
			if now.After(autoOffTarget) {
				log.Printf("[TIMER] One-shot Auto-OFF timer expired. Turning relay OFF.\n")
				s.autoOffActive = false
				s.autoOffTarget = time.Time{}
				s.relayState = "OFF"
				s.relayStateTime = now
				s.mu.Unlock()

				// Send command off outside lock
				_ = s.SendCommand("off")
				continue
			}
		}

		// Now check scheduler active status
		if !s.settings.SchedulerActive {
			s.schedulerTargetState = ""
			s.schedulerTargetSince = time.Time{}
			s.lastSchedulerStateCheck = time.Time{}
			s.lastSchedulerCorrection = time.Time{}
			s.mu.Unlock()
			continue
		}

		timeOn := s.settings.TimeOn
		timeOff := s.settings.TimeOff
		targetState := s.schedulerTargetState
		targetSince := s.schedulerTargetSince
		relayState := s.relayState

		if targetState == "" || targetSince.IsZero() {
			s.schedulerTargetState = "ON"
			s.schedulerTargetSince = now
			s.relayState = "ON"
			s.relayStateTime = now
			commandToSend = "on"
			shouldRequestState = true
			log.Println("[SCHEDULER] Initializing cycle in ON phase.")
		} else {
			elapsed := now.Sub(targetSince)

			if targetState == "ON" {
				limit := time.Duration(timeOn) * time.Minute
				if elapsed >= limit {
					log.Printf("[SCHEDULER] ON time limit reached (%d min). Turning relay OFF.\n", timeOn)
					s.schedulerTargetState = "OFF"
					s.schedulerTargetSince = now
					s.relayState = "OFF"
					s.relayStateTime = now
					commandToSend = "off"
					shouldRequestState = true
					targetState = "OFF"
				}
			} else if targetState == "OFF" {
				limit := time.Duration(timeOff) * time.Minute
				if elapsed >= limit {
					log.Printf("[SCHEDULER] OFF time limit reached (%d min). Turning relay ON.\n", timeOff)
					s.schedulerTargetState = "ON"
					s.schedulerTargetSince = now
					s.relayState = "ON"
					s.relayStateTime = now
					commandToSend = "on"
					shouldRequestState = true
					targetState = "ON"
				}
			}
		}

		if now.Sub(s.lastSchedulerStateCheck) >= 30*time.Second {
			s.lastSchedulerStateCheck = now
			shouldRequestState = true
		}

		relayStateKnown := relayState == "ON" || relayState == "OFF"
		if commandToSend == "" && relayStateKnown && targetState != "" && relayState != targetState && now.Sub(s.lastSchedulerCorrection) >= 15*time.Second {
			s.lastSchedulerCorrection = now
			commandToSend = strings.ToLower(targetState)
			shouldRequestState = true
			s.relayState = targetState
			s.relayStateTime = now
			log.Printf("[SCHEDULER] Relay drift detected. Expected %s, got %s. Correcting.\n", targetState, relayState)
		}

		s.mu.Unlock()

		if commandToSend != "" {
			_ = s.SendCommand(commandToSend)
		}
		if shouldRequestState {
			_ = s.SendCommand("state")
		}
	}
}

func (s *AutomationService) runDbLoggingLoop() {
	ticker := time.NewTicker(30 * time.Second) // Check every 30 seconds
	for range ticker.C {
		s.mu.Lock()
		db := s.db
		if db == nil || s.settings == nil || !s.settings.DbLogActive {
			s.mu.Unlock()
			continue
		}

		interval := s.settings.DbLogInterval
		if interval <= 0 {
			interval = 5 // Default to 5 minutes if not configured or 0
		}

		lastLogTime := s.lastDbLogTime
		lastData := s.lastData
		relayState := s.relayState
		rawCmd := s.rawCmd
		s.mu.Unlock()

		if lastData == nil {
			continue
		}

		// Check if it's time to log
		if time.Since(lastLogTime) >= time.Duration(interval)*time.Minute {
			// Save log
			logEntry := models.TelemetryLog{
				Timestamp:     time.Now(),
				Porcentaje:    parseFloat(lastData.Porcentaje),
				Nivel:         parseFloat(lastData.Nivel),
				Distancia:     parseFloat(lastData.Distancia),
				CaudalEntrada: parseFloat(lastData.CaudalEntrada),
				CaudalSalida:  parseFloat(lastData.CaudalSalida),
				Balance:       parseFloat(lastData.Balance),
				Lm:            parseFloat(lastData.Lm),
				Lm2:           parseFloat(lastData.Lm2),
				RelayState:    relayState,
				RelayCmd:      rawCmd,
			}

			if err := db.Create(&logEntry).Error; err != nil {
				log.Printf("[DB LOGGING] Error creating telemetry log: %v\n", err)
			} else {
				log.Printf("[DB LOGGING] Saved telemetry log at %v\n", logEntry.Timestamp)
				s.mu.Lock()
				s.lastDbLogTime = time.Now()
				retentionDays := s.settings.DbLogRetentionDays
				s.mu.Unlock()

				// Rolling prune old logs
				if retentionDays > 0 {
					cutoff := time.Now().AddDate(0, 0, -retentionDays)
					if err := db.Where("timestamp < ?", cutoff).Delete(&models.TelemetryLog{}).Error; err != nil {
						log.Printf("[DB LOGGING] Error pruning old logs: %v\n", err)
					}
				}
			}
		}
	}
}

func (s *AutomationService) StartAutoOffTimer(minutes int) error {
	s.mu.Lock()
	s.autoOffActive = true
	s.autoOffTarget = time.Now().Add(time.Duration(minutes) * time.Minute)

	// Save the last configured auto-off duration to DB
	if s.db != nil && s.settings != nil {
		s.settings.AutoOffDuration = minutes
		s.db.Model(s.settings).Update("auto_off_duration", minutes)
	}
	s.mu.Unlock()

	// Turn ON the relay
	return s.SendCommand("on")
}

func (s *AutomationService) StopAutoOffTimer() error {
	s.mu.Lock()
	s.autoOffActive = false
	s.autoOffTarget = time.Time{}
	s.mu.Unlock()

	// Turn OFF the relay
	return s.SendCommand("off")
}

func parseFloat(val string) float64 {
	var f float64
	_, _ = fmt.Sscanf(val, "%f", &f)
	return f
}
