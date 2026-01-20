import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.PROD 
  ? `ws://${window.location.host}/ws` 
  : `ws://${window.location.hostname}:8080/ws`;

/**
 * Custom hook to manage WebSocket connection for the pixel grid
 * @returns {Object} { grid, pixelUpdate, isConnected, sendPixel }
 */
export function usePixelWebSocket() {
  // Full grid state (only set once on init)
  const [grid, setGrid] = useState(null);
  
  // Single pixel updates for incremental canvas updates
  const [pixelUpdate, setPixelUpdate] = useState(null);
  
  // Connection status
  const [isConnected, setIsConnected] = useState(false);
  
  // WebSocket reference
  const wsRef = useRef(null);
  
  // Reconnection state
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('Connecting to WebSocket...', WS_URL);
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'init') {
          // Initial full grid state
          console.log('Received initial grid state');
          setGrid(data.grid);
        } else if (data.t === 'u') {
          // Single pixel update: { t: 'u', x, y, c }
          setPixelUpdate({
            x: data.x,
            y: data.y,
            color: data.c,
          });
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
        console.log(`Reconnecting in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, []);

  // Send a pixel update to the server
  const sendPixel = useCallback((x, y, color) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ x, y, c: color });
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket not connected, cannot send pixel');
    }
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    grid,
    pixelUpdate,
    isConnected,
    sendPixel,
  };
}
