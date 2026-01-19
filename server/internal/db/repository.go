package db

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Pixel represents a single cell on the grid
type Pixel struct {
	X      int  `gorm:"primaryKey;autoIncrement:false" json:"x"`
	Y      int  `gorm:"primaryKey;autoIncrement:false" json:"y"`
	Active bool `gorm:"type:tinyint(1);not null;default:0" json:"a"`
}

// TableName specifies the table name for Pixel
func (Pixel) TableName() string {
	return "pixels"
}

var DB *gorm.DB

// InitDB initializes the database connection and runs migrations
func InitDB() error {
	// Get database connection details from environment variables
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "3306")
	user := getEnv("DB_USER", "root")
	password := getEnv("DB_PASSWORD", "")
	dbname := getEnv("DB_NAME", "million_grids")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		user, password, host, port, dbname)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto-migrate the schema
	if err := DB.AutoMigrate(&Pixel{}); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database connected and migrated successfully")
	return nil
}

// LoadAllPixels retrieves all pixels from the database
func LoadAllPixels() ([]Pixel, error) {
	var pixels []Pixel
	result := DB.Find(&pixels)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to load pixels: %w", result.Error)
	}
	log.Printf("Loaded %d pixels from database", len(pixels))
	return pixels, nil
}

// SavePixel saves or updates a pixel in the database
func SavePixel(pixel Pixel) error {
	// Use UPSERT: insert or update on conflict
	result := DB.Save(&pixel)
	return result.Error
}

// SavePixelAsync saves a pixel asynchronously (fire-and-forget)
func SavePixelAsync(pixel Pixel) {
	go func() {
		if err := SavePixel(pixel); err != nil {
			log.Printf("Error saving pixel (%d, %d): %v", pixel.X, pixel.Y, err)
		}
	}()
}

// getEnv gets an environment variable with a default fallback
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
