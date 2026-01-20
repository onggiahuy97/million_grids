import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.PROD 
  ? `ws://${window.location.host}/ws` 
  : `ws://${window.location.hostname}:8080/ws`;

/**
 * Custom hook to manage WebSocket connection for the grid
 * Uses sparse format - only tracks active cells with their colors
 * @returns {Object} { activeCells, gridSize, isConnected, toggleCell }
 */
export function useGridWebSocket() {
  // Active cells stored as a Map of "x,y" -> color for O(1) lookup
  const [activeCells, setActiveCells] = useState(new Map());
  
  // Grid size from server
  const [gridSize, setGridSize] = useState(1000);
  
  // Connection status
  const [isConnected, setIsConnected] = useState(false);
  
  // Connected clients count
  const [connectedClients, setConnectedClients] = useState(0);
  
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

    // Close any existing connection to prevent duplicate connections
    if (wsRef.current) {
      // Remove onclose handler to prevent reconnection trigger during intentional close
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    console.log('Connecting to WebSocket...', WS_URL);
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      // Server may batch multiple JSON messages separated by newlines
      const messages = event.data.split('\n').filter(msg => msg.trim());
      
      for (const msg of messages) {
        try {
          const data = JSON.parse(msg);
          
          if (data.type === 'init') {
            // Initial state: { type: 'init', size: 1000, active: [{x, y, color}, ...] }
            console.log('Received initial state:', data.active?.length || 0, 'active cells');
            setGridSize(data.size || 1000);
            
            // Convert active array to Map with colors
            const activeMap = new Map();
            if (data.active) {
              data.active.forEach(cell => {
                activeMap.set(`${cell.x},${cell.y}`, cell.color || '#FFFFFF');
              });
            }
            setActiveCells(activeMap);
          } else if (data.t === 'u') {
            // Cell update: { t: 'u', x, y, a: 0|1, color }
            setActiveCells(prev => {
              const newMap = new Map(prev);
              const key = `${data.x},${data.y}`;
              if (data.a === 1) {
                newMap.set(key, data.color || '#FFFFFF');
              } else {
                newMap.delete(key);
              }
              return newMap;
            });
          } else if (data.t === 'c') {
            // Connection count update: { t: 'c', count: N }
            setConnectedClients(data.count || 0);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err, msg);
        }
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

  // Send a cell toggle to the server with color
  const toggleCell = useCallback((x, y, color = '#FF0000') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ x, y, color });
      console.log('Sending toggle message:', message);
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket not connected, cannot toggle cell. ReadyState:', wsRef.current?.readyState);
    }
  }, []);

  // Check if a cell is active (returns color string or false)
  const isCellActive = useCallback((x, y) => {
    const key = `${x},${y}`;
    return activeCells.has(key) ? activeCells.get(key) : false;
  }, [activeCells]);

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
    activeCells,
    gridSize,
    isConnected,
    connectedClients,
    toggleCell,
    isCellActive,
  };
}
