package main

import (
	"log"
	"net/http"

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

	// Create new client
	client := ws.NewClient(hub, conn)

	// Register the client with the hub
	hub.Register(client)

	// Send the current grid state to the new client
	if err := client.SendInitialState(); err != nil {
		log.Printf("Failed to send initial state: %v", err)
	}

	// Start the client's read/write pumps
	client.Start()
}

// handleHealth is a simple health check endpoint
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "ok", "clients": ` + string(rune(hub.ClientCount())) + `}`))
}
