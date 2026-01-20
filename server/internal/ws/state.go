package ws

import (
	"sync"

	"github.com/million_grids/server/internal/db"
)

const (
	// GridSize defines the dimensions of the grid (1000x1000)
	GridSize = 1000
)

// CellState holds the state of a single cell (active status and color)
type CellState struct {
	Active bool
	Color  string
}

// GridState holds the in-memory state of the grid (active/inactive with color)
type GridState struct {
	cells [GridSize][GridSize]CellState
	mu    sync.RWMutex
}

// Global grid instance
var Grid = &GridState{}

// Initialize sets up the grid with all cells inactive (false)
func (g *GridState) Initialize() {
	g.mu.Lock()
	defer g.mu.Unlock()

	// All cells default to inactive with white color
	for x := 0; x < GridSize; x++ {
		for y := 0; y < GridSize; y++ {
			g.cells[x][y] = CellState{Active: false, Color: "#FFFFFF"}
		}
	}
}

// LoadFromDB populates the grid from database pixels
func (g *GridState) LoadFromDB(pixels []db.Pixel) {
	g.mu.Lock()
	defer g.mu.Unlock()

	for _, p := range pixels {
		if p.X >= 0 && p.X < GridSize && p.Y >= 0 && p.Y < GridSize {
			color := p.Color
			if color == "" {
				color = "#FFFFFF"
			}
			g.cells[p.X][p.Y] = CellState{Active: p.Active, Color: color}
		}
	}
}

// GetCell returns the cell state at the given coordinates
func (g *GridState) GetCell(x, y int) CellState {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if x < 0 || x >= GridSize || y < 0 || y >= GridSize {
		return CellState{Active: false, Color: "#FFFFFF"}
	}
	return g.cells[x][y]
}

// SetCell updates the cell state at the given coordinates
func (g *GridState) SetCell(x, y int, active bool, color string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if x >= 0 && x < GridSize && y >= 0 && y < GridSize {
		g.cells[x][y] = CellState{Active: active, Color: color}
	}
}

// ToggleCell toggles the cell with a color and returns the new state
func (g *GridState) ToggleCell(x, y int, color string) (bool, string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if x >= 0 && x < GridSize && y >= 0 && y < GridSize {
		current := g.cells[x][y]
		newActive := !current.Active
		newColor := color
		if !newActive {
			// When turning off, reset to white
			newColor = "#FFFFFF"
		}
		g.cells[x][y] = CellState{Active: newActive, Color: newColor}
		return newActive, newColor
	}
	return false, "#FFFFFF"
}

// GetActiveCells returns a list of all active cell coordinates with colors (sparse format)
func (g *GridState) GetActiveCells() []db.Pixel {
	g.mu.RLock()
	defer g.mu.RUnlock()

	var active []db.Pixel
	for x := 0; x < GridSize; x++ {
		for y := 0; y < GridSize; y++ {
			if g.cells[x][y].Active {
				active = append(active, db.Pixel{
					X:      x,
					Y:      y,
					Active: true,
					Color:  g.cells[x][y].Color,
				})
			}
		}
	}
	return active
}
