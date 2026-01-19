import { useRef, useEffect, useCallback, useState, useMemo } from 'react';

const MIN_CELL_SIZE = 2;   // Minimum pixels per cell when zoomed out
const MAX_CELL_SIZE = 50;  // Maximum pixels per cell when zoomed in
const DEFAULT_CELL_SIZE = 20;

/**
 * VirtualGrid - Viewport-based grid rendering
 * Only renders visible cells for performance with 1000x1000 grid
 */
export function VirtualGrid({ gridSize, activeCells, isCellActive, onCellClick }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Viewport state
  const [cellSize, setCellSize] = useState(DEFAULT_CELL_SIZE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  // Calculate visible cell range based on viewport
  const visibleRange = useMemo(() => {
    const startX = Math.max(0, Math.floor(-offset.x / cellSize));
    const startY = Math.max(0, Math.floor(-offset.y / cellSize));
    const endX = Math.min(gridSize, Math.ceil((containerSize.width - offset.x) / cellSize));
    const endY = Math.min(gridSize, Math.ceil((containerSize.height - offset.y) / cellSize));
    
    return { startX, startY, endX, endY };
  }, [offset, cellSize, containerSize, gridSize]);

  // Track container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw the grid on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = containerSize;
    
    // Set canvas size
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const { startX, startY, endX, endY } = visibleRange;

    // Draw grid lines if cells are large enough
    if (cellSize >= 8) {
      ctx.strokeStyle = '#2d2d44';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = startX; x <= endX; x++) {
        const screenX = x * cellSize + offset.x;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = startY; y <= endY; y++) {
        const screenY = y * cellSize + offset.y;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
        ctx.stroke();
      }
    }

    // Draw active cells (white when active)
    ctx.fillStyle = '#FFFFFF';
    
    activeCells.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      
      // Only draw if in visible range
      if (x >= startX && x < endX && y >= startY && y < endY) {
        const screenX = x * cellSize + offset.x;
        const screenY = y * cellSize + offset.y;
        
        // Draw filled cell with small padding for grid line visibility
        const padding = cellSize >= 8 ? 1 : 0;
        ctx.fillRect(
          screenX + padding,
          screenY + padding,
          cellSize - padding * 2,
          cellSize - padding * 2
        );
      }
    });

    // Draw border around visible grid area
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    const gridScreenWidth = gridSize * cellSize;
    const gridScreenHeight = gridSize * cellSize;
    ctx.strokeRect(offset.x, offset.y, gridScreenWidth, gridScreenHeight);

  }, [activeCells, cellSize, offset, containerSize, visibleRange, gridSize]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newCellSize = Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, cellSize * zoomFactor));

    // Adjust offset to zoom toward mouse position
    const scaleRatio = newCellSize / cellSize;
    const newOffset = {
      x: mouseX - (mouseX - offset.x) * scaleRatio,
      y: mouseY - (mouseY - offset.y) * scaleRatio,
    };

    setCellSize(newCellSize);
    setOffset(newOffset);
  }, [cellSize, offset]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...offset };
  }, [offset]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy,
    });
  }, [isDragging]);

  // Handle mouse up
  const handleMouseUp = useCallback((e) => {
    const wasDragging = isDragging;
    setIsDragging(false);
    
    if (!wasDragging) return;
    
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    
    // If it was a click (minimal movement), toggle the cell
    if (dx < 5 && dy < 5) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Use offsetStartRef since offset state might be stale in closure
      const currentOffset = offsetStartRef.current;
      const cellX = Math.floor((mouseX - currentOffset.x) / cellSize);
      const cellY = Math.floor((mouseY - currentOffset.y) / cellSize);
      
      console.log('Click at cell:', cellX, cellY);
      
      if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
        onCellClick(cellX, cellY);
      }
    }
  }, [isDragging, cellSize, gridSize, onCellClick]);

  // Global mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Calculate stats
  const visibleCellCount = (visibleRange.endX - visibleRange.startX) * (visibleRange.endY - visibleRange.startY);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-[70vh] min-h-[400px] bg-gray-900 border-2 border-gray-700 rounded-lg cursor-crosshair overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <canvas
          ref={canvasRef}
          className="block"
        />
      </div>
      
      {/* Info overlay */}
      <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded text-sm space-y-1">
        <div>Zoom: {Math.round(cellSize / DEFAULT_CELL_SIZE * 100)}%</div>
        <div>Visible: {visibleCellCount.toLocaleString()} cells</div>
        <div>Active: {activeCells.size.toLocaleString()} cells</div>
      </div>

      {/* Coordinates overlay */}
      <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded text-sm">
        Range: ({visibleRange.startX}, {visibleRange.startY}) to ({visibleRange.endX}, {visibleRange.endY})
      </div>
    </div>
  );
}
