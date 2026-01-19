package ws

import (
	"sync"

	"github.com/million_grids/server/internal/db"
)

const (
	// GridSize defines the dimensions of the grid (1000x1000)
	GridSize = 1000
)

// GridState holds the in-memory state of the grid (boolean active/inactive)
type GridState struct {
	cells [GridSize][GridSize]bool
	mu    sync.RWMutex
}

// Global grid instance
var Grid = &GridState{}

// Initialize sets up the grid with all cells inactive (false)
func (g *GridState) Initialize() {
	g.mu.Lock()
	defer g.mu.Unlock()

	// All cells default to false (inactive), which is Go's zero value
	for x := 0; x < GridSize; x++ {
		for y := 0; y < GridSize; y++ {
			g.cells[x][y] = false
		}
	}
}

// LoadFromDB populates the grid from database pixels
func (g *GridState) LoadFromDB(pixels []db.Pixel) {
	g.mu.Lock()
	defer g.mu.Unlock()

	for _, p := range pixels {
		if p.X >= 0 && p.X < GridSize && p.Y >= 0 && p.Y < GridSize {
			g.cells[p.X][p.Y] = p.Active
		}
	}
}

// GetCell returns the active state at the given coordinates
func (g *GridState) GetCell(x, y int) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if x < 0 || x >= GridSize || y < 0 || y >= GridSize {
		return false
	}
	return g.cells[x][y]
}

// SetCell updates the active state at the given coordinates
func (g *GridState) SetCell(x, y int, active bool) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if x >= 0 && x < GridSize && y >= 0 && y < GridSize {
		g.cells[x][y] = active
	}
}

// ToggleCell toggles the cell and returns the new state
func (g *GridState) ToggleCell(x, y int) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	if x >= 0 && x < GridSize && y >= 0 && y < GridSize {
		g.cells[x][y] = !g.cells[x][y]
		return g.cells[x][y]
	}
	return false
}

// GetActiveCells returns a list of all active cell coordinates (sparse format)
func (g *GridState) GetActiveCells() []db.Pixel {
	g.mu.RLock()
	defer g.mu.RUnlock()

	var active []db.Pixel
	for x := 0; x < GridSize; x++ {
		for y := 0; y < GridSize; y++ {
			if g.cells[x][y] {
				active = append(active, db.Pixel{X: x, Y: y, Active: true})
			}
		}
	}
	return active
}
