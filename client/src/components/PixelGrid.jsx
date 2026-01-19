import { useRef, useEffect, useCallback, useState } from 'react';

const GRID_SIZE = 1000;
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 20;

/**
 * PixelGrid - Canvas-based pixel grid component
 * @param {Object} props
 * @param {Array<Array<string>>} props.grid - 2D array of hex colors (1000x1000)
 * @param {Object} props.pixelUpdate - Single pixel update { x, y, color }
 * @param {string} props.selectedColor - Currently selected color
 * @param {Function} props.onPixelClick - Callback when pixel is clicked (x, y)
 */
export function PixelGrid({ grid, pixelUpdate, selectedColor, onPixelClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const ctxRef = useRef(null);
  
  // Viewport state for pan/zoom
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    ctxRef.current = ctx;

    // Fill with white initially
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
  }, []);

  // Draw the full grid when it arrives
  useEffect(() => {
    if (!grid || !ctxRef.current) return;

    const ctx = ctxRef.current;
    console.log('Drawing full grid...');

    // Use ImageData for faster bulk pixel drawing
    const imageData = ctx.createImageData(GRID_SIZE, GRID_SIZE);
    const data = imageData.data;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const color = grid[y]?.[x] || '#FFFFFF';
        const { r, g, b } = hexToRgb(color);
        const idx = (y * GRID_SIZE + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    console.log('Full grid drawn');
  }, [grid]);

  // Handle incremental pixel updates
  useEffect(() => {
    if (!pixelUpdate || !ctxRef.current) return;

    const ctx = ctxRef.current;
    const { x, y, color } = pixelUpdate;

    // Draw only the single pixel that changed
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }, [pixelUpdate]);

  // Convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 255, g: 255, b: 255 };
  };

  // Calculate pixel coordinates from mouse event
  const getPixelCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Account for offset and scale
    const x = Math.floor((mouseX - offset.x) / scale);
    const y = Math.floor((mouseY - offset.y) / scale);

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      return { x, y };
    }
    return null;
  }, [scale, offset]);

  // Handle canvas click
  const handleClick = useCallback((e) => {
    if (isDragging) return;
    
    const coords = getPixelCoords(e);
    if (coords && onPixelClick) {
      onPixelClick(coords.x, coords.y);
    }
  }, [getPixelCoords, onPixelClick, isDragging]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate new scale
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));

    // Adjust offset to zoom toward mouse position
    const scaleRatio = newScale / scale;
    const newOffset = {
      x: mouseX - (mouseX - offset.x) * scaleRatio,
      y: mouseY - (mouseY - offset.y) * scaleRatio,
    };

    setScale(newScale);
    setOffset(newOffset);
  }, [scale, offset]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Only left click
    
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
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse listeners for dragging
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

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-gray-900 border-2 border-gray-700 rounded-lg cursor-crosshair"
      style={{ width: '800px', height: '600px' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        width={GRID_SIZE}
        height={GRID_SIZE}
        style={{
          position: 'absolute',
          left: offset.x,
          top: offset.y,
          width: GRID_SIZE * scale,
          height: GRID_SIZE * scale,
          imageRendering: 'pixelated',
        }}
      />
      
      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
        {Math.round(scale * 100)}%
      </div>

      {/* Loading overlay */}
      {!grid && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-xl">Loading grid...</div>
        </div>
      )}
    </div>
  );
}
