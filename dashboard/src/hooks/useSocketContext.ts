/**
 * useSocketContext Hook
 *
 * Hook to access the shared socket context.
 *
 * @throws Error if used outside SocketProvider
 * @returns Socket context value
 */

import { useContext } from 'react';
import { SocketContext, type SocketContextValue } from '@context/SocketContext';

export function useSocketContext(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
