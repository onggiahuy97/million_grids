package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/million_grids/server/internal/db"
	"github.com/million_grids/server/internal/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for development (configure properly in production)
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var hub *ws.Hub

func main() {
	log.Println("Starting Million Grids Server...")

	// Initialize database connection
	if err := db.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize the in-memory grid with default colors
	ws.Grid.Initialize()

	// Load existing pixels from database into memory
	pixels, err := db.LoadAllPixels()
	if err != nil {
		log.Printf("Warning: Failed to load pixels from database: %v", err)
	} else {
		ws.Grid.LoadFromDB(pixels)
		log.Printf("Loaded %d pixels into memory", len(pixels))
	}

	// Create and start the WebSocket hub
	hub = ws.NewHub()
	go hub.Run()

	// Set up HTTP routes
	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/health", handleHealth)

	// Start the HTTP server
	addr := ":8080"
	log.Printf("Server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// handleWebSocket upgrades HTTP connections to WebSocket
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Extract client IP address
	ipAddress := getClientIP(r)

	// Create new client with IP address
	client := ws.NewClient(hub, conn, ipAddress)

	// Register the client with the hub
	hub.Register(client)

	// Send the current grid state to the new client
	if err := client.SendInitialState(); err != nil {
		log.Printf("Failed to send initial state: %v", err)
	}

	// Start the client's read/write pumps
	client.Start()
}

// getClientIP extracts the client's IP address from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for proxies/load balancers)
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// handleHealth is a simple health check endpoint
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf(`{"status": "ok", "clients": %d}`, hub.ClientCount())))
}
