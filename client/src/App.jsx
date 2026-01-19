import { useCallback } from 'react';
import { useGridWebSocket } from './hooks/useGridWebSocket';
import { VirtualGrid } from './components/VirtualGrid';

function App() {
  const { activeCells, gridSize, isConnected, connectedClients, toggleCell, isCellActive } = useGridWebSocket();

  // Handle cell click from grid
  const handleCellClick = useCallback((x, y) => {
    toggleCell(x, y);
  }, [toggleCell]);

  return (
    <div className="h-screen w-screen flex flex-col items-center overflow-hidden bg-gray-900">
      {/* Header & Status Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div>
          <h1 className="text-2xl font-bold text-white drop-shadow-md">Million Grids</h1>
          <p className="text-gray-300 text-sm drop-shadow-md">
            {gridSize.toLocaleString()}×{gridSize.toLocaleString()} • {isConnected ? 'Connected' : 'Disconnected'}
          </p>
          {isConnected && connectedClients > 0 && (
            <p className="text-gray-300 text-sm drop-shadow-md">
              {connectedClients} {connectedClients === 1 ? 'user' : 'users'} online
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div 
            className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} shadow-sm`}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 w-full h-full">
        <VirtualGrid
          gridSize={gridSize}
          activeCells={activeCells}
          isCellActive={isCellActive}
          onCellClick={handleCellClick}
        />
      </div>

      {/* Instructions Overlay */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none text-gray-400 text-xs bg-black/50 p-2 rounded backdrop-blur-sm">
        <p><strong>Click</strong> to toggle • <strong>Scroll</strong> zoom • <strong>Drag</strong> pan</p>
      </div>
    </div>
  );
}

export default App;