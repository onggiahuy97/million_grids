package ws

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
	"github.com/million_grids/server/internal/db"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512
)

// CellToggle represents a cell toggle message from client (now with color)
type CellToggle struct {
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Color string `json:"color,omitempty"` // Hex color like "#FF0000"
}

// BroadcastCellUpdate is sent to all clients when a cell changes
type BroadcastCellUpdate struct {
	Type   string `json:"t"`
	X      int    `json:"x"`
	Y      int    `json:"y"`
	Active int    `json:"a"`     // 0 or 1 for JSON
	Color  string `json:"color"` // Hex color
}

// ActiveCell represents an active cell in sparse format (with color)
type ActiveCell struct {
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Color string `json:"color"`
}

// InitMessage represents the initial state sent to new clients (sparse format)
type InitMessage struct {
	Type   string       `json:"type"`
	Size   int          `json:"size"`
	Active []ActiveCell `json:"active"`
}

// Client represents a WebSocket client connection
type Client struct {
	hub *Hub

	// The websocket connection
	conn *websocket.Conn

	// Buffered channel of outbound messages
	send chan []byte

	// Client IP address for tracking
	ipAddress string
}

// NewClient creates a new Client instance
func NewClient(hub *Hub, conn *websocket.Conn, ipAddress string) *Client {
	return &Client{
		hub:       hub,
		conn:      conn,
		send:      make(chan []byte, 256),
		ipAddress: ipAddress,
	}
}

// readPump pumps messages from the websocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		log.Printf("Received message: %s", string(message))

		// Parse the cell toggle (frontend sends {x, y})
		var toggle CellToggle
		if err := json.Unmarshal(message, &toggle); err != nil {
			log.Printf("Error parsing message: %v", err)
			continue
		}

		log.Printf("Parsed toggle: x=%d, y=%d", toggle.X, toggle.Y)

		// All incoming messages are cell toggles
		c.handleCellToggle(toggle)
	}
}

// handleCellToggle processes a cell toggle from the client
func (c *Client) handleCellToggle(toggle CellToggle) {
	// Validate coordinates
	if toggle.X < 0 || toggle.X >= GridSize || toggle.Y < 0 || toggle.Y >= GridSize {
		log.Printf("Invalid coordinates: (%d, %d)", toggle.X, toggle.Y)
		return
	}

	// Validate color - must be one of the 7 allowed colors
	color := toggle.Color
	if color == "" {
		color = "#FF0000" // Default to red if no color provided
	}
	if !db.IsValidColor(color) {
		log.Printf("Invalid color: %s, defaulting to red", color)
		color = "#FF0000"
	}

	// Toggle the cell with color and get new state (thread-safe)
	newState, newColor := Grid.ToggleCell(toggle.X, toggle.Y, color)

	// Get current timestamp
	now := time.Now()

	// Asynchronously save to database (fire-and-forget)
	db.SavePixelAsync(db.Pixel{
		X:         toggle.X,
		Y:         toggle.Y,
		Active:    newState,
		Color:     newColor,
		CreatedBy: c.ipAddress,
		ModifyAt:  &now,
		ModifyBy:  c.ipAddress,
	})

	// Convert bool to int for JSON
	activeInt := 0
	if newState {
		activeInt = 1
	}

	// Broadcast the update to all clients (with color)
	broadcastMsg, _ := json.Marshal(BroadcastCellUpdate{
		Type:   "u",
		X:      toggle.X,
		Y:      toggle.Y,
		Active: activeInt,
		Color:  newColor,
	})
	c.hub.Broadcast(broadcastMsg)

	log.Printf("Cell toggled: (%d, %d) -> %v, color: %s, by: %s", toggle.X, toggle.Y, newState, newColor, c.ipAddress)
}

// writePump pumps messages from the hub to the websocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Start begins the read and write pumps for the client
func (c *Client) Start() {
	go c.writePump()
	go c.readPump()
}

// SendInitialState sends the active cells to a newly connected client (sparse format with colors)
func (c *Client) SendInitialState() error {
	activeCells := Grid.GetActiveCells()

	// Convert to ActiveCell format for JSON (includes color)
	activeList := make([]ActiveCell, len(activeCells))
	for i, cell := range activeCells {
		activeList[i] = ActiveCell{X: cell.X, Y: cell.Y, Color: cell.Color}
	}

	msg := InitMessage{
		Type:   "init",
		Size:   GridSize,
		Active: activeList,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	c.send <- data
	return nil
}
