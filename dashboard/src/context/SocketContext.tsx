/**
 * Socket Context - Provides a single shared socket.io connection to all components
 * @module contexts/SocketContext
 */
/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { API_CONFIG, SOCKET } from '@constants';

/**
 * Socket event types
 */

/**
 * Context value type
 */
interface SocketContextValue {
  socket: Socket | null;
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [dbLogs, setDbLogs] = useState<string[]>([]);

  // Use refs to avoid stale closures in event handlers
  const logsRef = useRef(logs);
  const dbLogsRef = useRef(dbLogs);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    dbLogsRef.current = dbLogs;
  }, [dbLogs]);

  useEffect(() => {
    const socketUrl = API_CONFIG.BASE_URL || window.location.origin;
    const socketInstance = io(socketUrl, {
        reconnection: SOCKET.RECONNECTION,
        reconnectionAttempts: SOCKET.RECONNECTION_ATTEMPTS,
        reconnectionDelay: SOCKET.RECONNECTION_DELAY_MS,
        timeout: SOCKET.TIMEOUT_MS,
    });
    socketRef.current = socketInstance;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);

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

    // Cleanup on unmount
    return () => {
      socketInstance.off('connect');
      socketInstance.off('disconnect');
      socketInstance.off('bot:status');
      socketInstance.off('logs:init');
      socketInstance.off('log');
      socketInstance.off('db:log');
      socketInstance.disconnect();
      socketRef.current = null;
      setSocket(null);
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
    socket,
    isConnected,
    isRestarting,
    clearRestarting,
    logs,
    dbLogs,
    clearLogs,
    clearDbLogs,
  }), [socket, isConnected, isRestarting, clearRestarting, logs, dbLogs, clearLogs, clearDbLogs]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Hook to access the shared socket context
 * 
 * @throws Error if used outside SocketProvider
 * @returns Socket context value
 */
export function useSocketContext(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
