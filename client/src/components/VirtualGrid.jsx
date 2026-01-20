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
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [initialized, setInitialized] = useState(false);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  
  // Pinch-to-zoom state (use refs to avoid stale closures in event listeners)
  const isPinchingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const pinchStartRef = useRef({ distance: 0, cellSize: DEFAULT_CELL_SIZE, centerX: 0, centerY: 0 });

  // Center the grid when container size is known
  useEffect(() => {
    if (!initialized && containerSize.width > 0 && containerSize.height > 0) {
      // Calculate total grid size in pixels
      const totalGridWidth = gridSize * cellSize;
      const totalGridHeight = gridSize * cellSize;
      
      // Center position
      const centerX = (containerSize.width - totalGridWidth) / 2;
      const centerY = (containerSize.height - totalGridHeight) / 2;
      
      setOffset({ x: centerX, y: centerY });
      setInitialized(true);
    }
  }, [containerSize, gridSize, cellSize, initialized]);

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

    // Draw active cells with their colors
    activeCells.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number);
      
      // Only draw if in visible range
      if (x >= startX && x < endX && y >= startY && y < endY) {
        const screenX = x * cellSize + offset.x;
        const screenY = y * cellSize + offset.y;
        
        // Set fill color from cell data
        ctx.fillStyle = color || '#FFFFFF';
        
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

  // Handle touch start for dragging (mobile) and pinch-to-zoom
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch-to-zoom start
      e.preventDefault();
      isPinchingRef.current = true;
      isDraggingRef.current = false;
      setIsDragging(false);
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const distance = Math.hypot(dx, dy);
      
      // Center point between two fingers
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
      const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
      
      pinchStartRef.current = {
        distance,
        cellSize,
        centerX,
        centerY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    } else if (e.touches.length === 1 && !isPinchingRef.current) {
      // Single finger drag
      const touch = e.touches[0];
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      offsetStartRef.current = { ...offset };
    }
  }, [offset, cellSize]);

  // Handle touch move for dragging (mobile) and pinch-to-zoom
  const handleTouchMove = useCallback((e) => {
    e.preventDefault(); // Prevent page scrolling
    
    if (e.touches.length === 2 && isPinchingRef.current) {
      // Pinch-to-zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const distance = Math.hypot(dx, dy);
      
      // Calculate new cell size based on pinch ratio
      const scaleRatio = distance / pinchStartRef.current.distance;
      const newCellSize = Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, 
        pinchStartRef.current.cellSize * scaleRatio));
      
      // Adjust offset to zoom toward pinch center
      const actualRatio = newCellSize / pinchStartRef.current.cellSize;
      const newOffset = {
        x: pinchStartRef.current.centerX - (pinchStartRef.current.centerX - pinchStartRef.current.offsetX) * actualRatio,
        y: pinchStartRef.current.centerY - (pinchStartRef.current.centerY - pinchStartRef.current.offsetY) * actualRatio,
      };
      
      setCellSize(newCellSize);
      setOffset(newOffset);
    } else if (e.touches.length === 1 && isDraggingRef.current && !isPinchingRef.current) {
      // Single finger pan
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;

      setOffset({
        x: offsetStartRef.current.x + dx,
        y: offsetStartRef.current.y + dy,
      });
    }
  }, []);

  // Handle touch end (tap to click cell)
  const handleTouchEnd = useCallback((e) => {
    // Prevent synthetic mouse/click events from firing after touch
    e.preventDefault();
    
    // If we were pinching, just reset state
    if (isPinchingRef.current) {
      isPinchingRef.current = false;
      isDraggingRef.current = false;
      setIsDragging(false);
      return;
    }
    
    if (e.changedTouches.length === 1 && !isPinchingRef.current) {
      const touch = e.changedTouches[0];
      const dx = Math.abs(touch.clientX - dragStartRef.current.x);
      const dy = Math.abs(touch.clientY - dragStartRef.current.y);
      
      // If it was a tap (minimal movement), click the cell
      if (dx < 10 && dy < 10 && onCellClick) {
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const touchX = touch.clientX - rect.left;
          const touchY = touch.clientY - rect.top;
          
          const currentOffset = offsetStartRef.current;
          const cellX = Math.floor((touchX - currentOffset.x) / cellSize);
          const cellY = Math.floor((touchY - currentOffset.y) / cellSize);
          
          console.log('Touch tap at cell:', cellX, cellY);
          
          if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
            onCellClick(cellX, cellY);
          }
        }
      }
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  }, [cellSize, gridSize, onCellClick]);

  // Global mouse and touch listeners for dragging
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch move needs passive: false to allow preventDefault
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('touchmove', handleTouchMove);
      };
    }

    return () => {
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  // Wheel listener with passive: false to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Calculate stats
  const visibleCellCount = (visibleRange.endX - visibleRange.startX) * (visibleRange.endY - visibleRange.startY);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-gray-900 cursor-crosshair overflow-hidden"
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
      <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded text-sm text-right">
        Range: ({visibleRange.startX}, {visibleRange.startY}) to ({visibleRange.endX}, {visibleRange.endY})
      </div>
    </div>
  );
}
