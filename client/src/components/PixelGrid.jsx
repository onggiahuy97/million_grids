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
  
  // Pinch-to-zoom state (use refs to avoid stale closures in event listeners)
  const isPinchingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const pinchStartRef = useRef({ distance: 0, scale: DEFAULT_SCALE, centerX: 0, centerY: 0 });

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
        scale,
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
  }, [offset, scale]);

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
      
      // Calculate new scale based on pinch ratio
      const scaleRatio = distance / pinchStartRef.current.distance;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, 
        pinchStartRef.current.scale * scaleRatio));
      
      // Adjust offset to zoom toward pinch center
      const actualRatio = newScale / pinchStartRef.current.scale;
      const newOffset = {
        x: pinchStartRef.current.centerX - (pinchStartRef.current.centerX - pinchStartRef.current.offsetX) * actualRatio,
        y: pinchStartRef.current.centerY - (pinchStartRef.current.centerY - pinchStartRef.current.offsetY) * actualRatio,
      };
      
      setScale(newScale);
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

  // Handle touch end (tap to click pixel)
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
      
      // If it was a tap (minimal movement), click the pixel
      if (dx < 10 && dy < 10 && onPixelClick) {
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const touchX = touch.clientX - rect.left;
          const touchY = touch.clientY - rect.top;
          
          const x = Math.floor((touchX - offsetStartRef.current.x) / scale);
          const y = Math.floor((touchY - offsetStartRef.current.y) / scale);
          
          if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            onPixelClick(x, y);
          }
        }
      }
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  }, [scale, onPixelClick]);

  // Add global mouse and touch listeners for dragging
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

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-gray-900 border-2 border-gray-700 rounded-lg cursor-crosshair"
      style={{ width: '800px', height: '600px', touchAction: 'none' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
