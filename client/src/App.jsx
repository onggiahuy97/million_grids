import { useCallback } from 'react';
import { useGridWebSocket } from './hooks/useGridWebSocket';
import { VirtualGrid } from './components/VirtualGrid';

function App() {
  const { activeCells, gridSize, isConnected, toggleCell, isCellActive } = useGridWebSocket();

  // Handle cell click from grid
  const handleCellClick = useCallback((x, y) => {
    toggleCell(x, y);
  }, [toggleCell]);

  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4">
      {/* Header */}
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Million Grids</h1>
        <p className="text-gray-400">Real-time collaborative {gridSize.toLocaleString()}×{gridSize.toLocaleString()} grid</p>
      </header>

      {/* Connection Status */}
      <div className="mb-4 flex items-center gap-2">
        <div 
          className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-gray-300 text-sm">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Grid */}
      <div className="w-full max-w-6xl">
        <VirtualGrid
          gridSize={gridSize}
          activeCells={activeCells}
          isCellActive={isCellActive}
          onCellClick={handleCellClick}
        />
      </div>

      {/* Instructions */}
      <div className="mt-6 text-gray-500 text-sm text-center max-w-md space-y-1">
        <p><strong>Click</strong> to toggle a cell on/off</p>
        <p><strong>Scroll</strong> to zoom in/out</p>
        <p><strong>Drag</strong> to pan around the grid</p>
      </div>
    </div>
  );
}

export default App;