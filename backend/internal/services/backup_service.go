package services

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/erick/pagosbolivar/internal/models"
	"gorm.io/gorm"
)

type BackupFile struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"created_at"`
}

type BackupStatus struct {
	Settings models.BackupSetting `json:"settings"`
	Files    []BackupFile         `json:"files"`
}

type BackupService struct {
	mu     sync.Mutex
	db     *gorm.DB
	dbPath string
}

var (
	globalBackupService *BackupService
	backupOnce          sync.Once
)

func GetBackupService() *BackupService {
	backupOnce.Do(func() {
		globalBackupService = &BackupService{}
		go globalBackupService.runLoop()
	})
	return globalBackupService
}

func (s *BackupService) SetDB(db *gorm.DB, dbPath string) {
	s.mu.Lock()
	s.db = db
	s.dbPath = dbPath
	s.mu.Unlock()

	_, _ = s.LoadSettings()
}

func (s *BackupService) LoadSettings() (models.BackupSetting, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loadSettingsLocked()
}

func (s *BackupService) UpdateSettings(input models.BackupSetting) (models.BackupSetting, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	current, err := s.loadSettingsLocked()
	if err != nil {
		return current, err
	}

	current.Enabled = input.Enabled
	current.IntervalMinutes = input.IntervalMinutes
	current.RetentionCount = input.RetentionCount
	current.BackupDir = strings.TrimSpace(input.BackupDir)
	normalizeBackupSetting(&current, s.dbPath)

	if err := s.db.Save(&current).Error; err != nil {
		return current, err
	}
	return current, nil
}

func (s *BackupService) GetStatus() (BackupStatus, error) {
	settings, err := s.LoadSettings()
	if err != nil {
		return BackupStatus{}, err
	}
	files, err := ListBackupFiles(settings.BackupDir)
	if err != nil {
		return BackupStatus{}, err
	}
	return BackupStatus{Settings: settings, Files: files}, nil
}

func (s *BackupService) CreateBackup(reason string) (BackupFile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	settings, err := s.loadSettingsLocked()
	if err != nil {
		return BackupFile{}, err
	}

	if err := os.MkdirAll(settings.BackupDir, 0755); err != nil {
		s.recordErrorLocked(&settings, err)
		return BackupFile{}, err
	}

	now := time.Now()
	filename := fmt.Sprintf("pagos_backup_%s.db", now.Format("20060102_150405"))
	destPath := filepath.Join(settings.BackupDir, filename)

	if err := s.db.Exec("VACUUM INTO ?", destPath).Error; err != nil {
		s.recordErrorLocked(&settings, err)
		return BackupFile{}, err
	}

	info, err := os.Stat(destPath)
	if err != nil {
		s.recordErrorLocked(&settings, err)
		return BackupFile{}, err
	}

	settings.LastRunAt = &now
	settings.LastBackupFile = filename
	settings.LastBackupSize = info.Size()
	settings.LastBackupError = ""
	_ = s.db.Save(&settings).Error

	if settings.RetentionCount > 0 {
		_ = pruneBackups(settings.BackupDir, settings.RetentionCount)
	}

	_ = reason
	return BackupFile{
		Name:      filename,
		Path:      destPath,
		Size:      info.Size(),
		CreatedAt: info.ModTime().Format(time.RFC3339),
	}, nil
}

func (s *BackupService) ResolveBackupPath(name string) (string, error) {
	settings, err := s.LoadSettings()
	if err != nil {
		return "", err
	}

	cleanName := filepath.Base(name)
	if cleanName == "." || cleanName == string(filepath.Separator) || !strings.HasSuffix(cleanName, ".db") {
		return "", fmt.Errorf("invalid backup file")
	}

	fullPath := filepath.Join(settings.BackupDir, cleanName)
	if _, err := os.Stat(fullPath); err != nil {
		return "", err
	}
	return fullPath, nil
}

func (s *BackupService) runLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		settings, err := s.LoadSettings()
		if err != nil || !settings.Enabled {
			continue
		}

		interval := time.Duration(settings.IntervalMinutes) * time.Minute
		if interval <= 0 {
			interval = 24 * time.Hour
		}

		if settings.LastRunAt == nil || time.Since(*settings.LastRunAt) >= interval {
			_, _ = s.CreateBackup("scheduled")
		}
	}
}

func (s *BackupService) loadSettingsLocked() (models.BackupSetting, error) {
	if s.db == nil {
		return models.BackupSetting{}, fmt.Errorf("database not initialized")
	}

	var settings models.BackupSetting
	if err := s.db.First(&settings, 1).Error; err != nil {
		settings = models.BackupSetting{ID: 1}
		normalizeBackupSetting(&settings, s.dbPath)
		if createErr := s.db.Create(&settings).Error; createErr != nil {
			return settings, createErr
		}
		return settings, nil
	}

	before := settings
	normalizeBackupSetting(&settings, s.dbPath)
	if before.IntervalMinutes != settings.IntervalMinutes || before.RetentionCount != settings.RetentionCount || before.BackupDir != settings.BackupDir {
		_ = s.db.Save(&settings).Error
	}
	return settings, nil
}

func (s *BackupService) recordErrorLocked(settings *models.BackupSetting, err error) {
	settings.LastBackupError = err.Error()
	_ = s.db.Save(settings).Error
}

func normalizeBackupSetting(settings *models.BackupSetting, dbPath string) {
	settings.ID = 1
	if settings.IntervalMinutes <= 0 {
		settings.IntervalMinutes = 1440
	}
	if settings.RetentionCount <= 0 {
		settings.RetentionCount = 7
	}
	if strings.TrimSpace(settings.BackupDir) == "" {
		baseDir := filepath.Dir(dbPath)
		if baseDir == "." || baseDir == "" {
			baseDir = "."
		}
		settings.BackupDir = filepath.Join(baseDir, "backups")
	}
}

func ListBackupFiles(dir string) ([]BackupFile, error) {
	if strings.TrimSpace(dir) == "" {
		return []BackupFile{}, nil
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	files := make([]BackupFile, 0)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".db") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, BackupFile{
			Name:      entry.Name(),
			Path:      filepath.Join(dir, entry.Name()),
			Size:      info.Size(),
			CreatedAt: info.ModTime().Format(time.RFC3339),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].CreatedAt > files[j].CreatedAt
	})
	return files, nil
}

func pruneBackups(dir string, keep int) error {
	files, err := ListBackupFiles(dir)
	if err != nil {
		return err
	}
	for i := keep; i < len(files); i++ {
		_ = os.Remove(files[i].Path)
	}
	return nil
}
