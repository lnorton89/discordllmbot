/**
 * Socket Context - Provides a single shared socket.io connection to all components
 * @module contexts/SocketContext
 */

import React, { createContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { SOCKET, URLS } from '@constants';

/**
 * Socket event types
 */

/**
 * Context value type
 */
interface SocketContextValue {
  getSocket: () => Socket | null;
  isConnected: boolean;
  isRestarting: boolean;
  clearRestarting: () => void;
  logs: string[];
  dbLogs: string[];
  clearLogs: () => void;
  clearDbLogs: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

/**
 * Socket provider props
 */
interface SocketProviderProps {
  children: React.ReactNode;
}

/**
 * Convert HTTP URL to WebSocket URL using constants
 */
function convertHttpToWs(url: string): string {
  if (url.startsWith(URLS.SOCKET.HTTP_TO_WS['https://'])) {
    return url.replace(URLS.SOCKET.HTTP_TO_WS['https://'], URLS.SOCKET.HTTP_TO_WS['wss://']);
  }
  if (url.startsWith(URLS.SOCKET.HTTP_TO_WS['http://'])) {
    return url.replace(URLS.SOCKET.HTTP_TO_WS['http://'], URLS.SOCKET.HTTP_TO_WS['ws://']);
  }
  return url;
}

/**
 * Socket Provider Component
 *
 * Creates a single socket.io connection and shares it across the entire app.
 * All components should use the useSocket() hook to access socket functionality.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <SocketProvider>
 *   <AppContent />
 * </SocketProvider>
 *
 * // In any component
 * const { socket, isConnected } = useSocket();
 * ```
 */
export function SocketProvider({ children }: SocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [dbLogs, setDbLogs] = useState<string[]>([]);

  // Use refs to avoid stale closures in event handlers
  const logsRef = useRef(logs);
  const dbLogsRef = useRef(dbLogs);
  const socketRef = useRef<Socket | null>(null);
  const isSocketInitialized = useRef(false);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    dbLogsRef.current = dbLogs;
  }, [dbLogs]);

  // Initialize socket once, survive HMR
  useEffect(() => {
    if (isSocketInitialized.current) return;
    isSocketInitialized.current = true;

    // In Docker, connect directly to bot service using ws:// instead of http://
    // VITE_API_URL is set to http://bot:3000 in Docker, convert to ws://bot:3000
    const viteApiUrl = import.meta.env.VITE_API_URL;
    const socketUrl = viteApiUrl
      ? convertHttpToWs(viteApiUrl).replace('/api', '')
      : window.location.origin;
    
    const socketInstance = io(socketUrl, {
        reconnection: SOCKET.RECONNECTION,
        reconnectionAttempts: SOCKET.RECONNECTION_ATTEMPTS,
        reconnectionDelay: SOCKET.RECONNECTION_DELAY_MS,
        timeout: SOCKET.TIMEOUT_MS,
        transports: ['websocket', 'polling'],
        upgrade: true,
    });

    socketRef.current = socketInstance;

    // Connection status
    socketInstance.on('connect', () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));

    // Bot status events
    socketInstance.on('bot:status', (status: { isRestarting: boolean }) => {
      setIsRestarting(status.isRestarting);
    });

    // Log events
    socketInstance.on('logs:init', (initialLogs: string[]) => {
      setLogs(initialLogs.filter((l) => l.trim()).slice(-200));
    });

    socketInstance.on('log', (line: string) => {
      setLogs(prev => [...prev.slice(-199), line]);
    });

    socketInstance.on('db:log', (line: string) => {
      setDbLogs(prev => [...prev.slice(-199), line]);
      // Also add to general logs
      setLogs(prev => [...prev.slice(-199), line]);
    });

    // Cleanup on unmount - but don't destroy socket, just remove listeners
    return () => {
      socketInstance.off('connect');
      socketInstance.off('disconnect');
      socketInstance.off('bot:status');
      socketInstance.off('logs:init');
      socketInstance.off('log');
      socketInstance.off('db:log');
      // Don't disconnect - keep socket alive for HMR
    };
  }, []);

  const clearRestarting = useCallback(() => {
    setIsRestarting(false);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const clearDbLogs = useCallback(() => {
    setDbLogs([]);
  }, []);

  const value = useMemo(() => ({
    isConnected,
    isRestarting,
    clearRestarting,
    logs,
    dbLogs,
    clearLogs,
    clearDbLogs,
    getSocket: () => socketRef.current,
  }), [isConnected, isRestarting, clearRestarting, logs, dbLogs, clearLogs, clearDbLogs]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export { SocketContext };
export type { SocketContextValue };
