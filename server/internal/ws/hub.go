package ws

import (
	"fmt"
	"log"
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages to them
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from the clients to broadcast
	broadcast chan []byte

	// Register requests from the clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe access to clients map
	mu sync.RWMutex
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// Check if client is already registered to prevent duplicate counting
			alreadyRegistered := h.clients[client]
			if !alreadyRegistered {
				h.clients[client] = true
			}
			h.mu.Unlock()
			if alreadyRegistered {
				log.Printf("Client already registered, skipping. Total clients: %d", h.ClientCount())
				continue
			}
			log.Printf("Client registered. Total clients: %d", h.ClientCount())
			h.BroadcastClientCount()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("Client unregistered. Total clients: %d", h.ClientCount())
			h.BroadcastClientCount()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client's send buffer is full, schedule for removal
					go func(c *Client) {
						h.unregister <- c
					}(client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// ClientCount returns the number of connected clients
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Broadcast sends a message to all connected clients
func (h *Hub) Broadcast(message []byte) {
	h.broadcast <- message
}

// Register adds a new client to the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// BroadcastClientCount sends the current client count to all connected clients
func (h *Hub) BroadcastClientCount() {
	count := h.ClientCount()
	message := []byte(fmt.Sprintf(`{"t":"c","count":%d}`, count))
	h.Broadcast(message)
}
