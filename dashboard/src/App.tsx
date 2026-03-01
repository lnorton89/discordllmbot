/**
 * Main application component with routing and layout.
 * @module App
 */
import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, useMediaQuery, CircularProgress, Typography } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Dns as DnsIcon,
  Chat as ChatIcon,
  Settings as SettingsIcon,
  ListAlt as ListAltIcon,
  Storage as StorageIcon,
  Analytics as AnalyticsIcon,
  Psychology as MemoryIcon,
} from '@mui/icons-material';

import theme from '@theme';
import { SocketProvider } from '@context/SocketContext';
import { Dashboard, Settings, Servers, Playground, Logs, Database, Analytics, Memory } from '@pages';
import { ErrorBoundary } from '@components/common';
import { Header, Sidebar, MainContent } from '@components/Layout';
import { useHealth, useServers } from '@hooks';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
  { to: '/servers', label: 'Servers', icon: <DnsIcon /> },
  { to: '/memory', label: 'Memory', icon: <MemoryIcon /> },
  { to: '/database', label: 'Database', icon: <StorageIcon /> },
  { to: '/playground', label: 'Playground', icon: <ChatIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  { to: '/logs', label: 'Logs', icon: <ListAltIcon /> },
];

const DRAWER_WIDTH = 240;

/**
 * Main app content with layout management.
 * Handles responsive drawer state for mobile.
 */
function AppContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { health, loading, error } = useHealth();
  const { servers } = useServers();
  const isApiUnavailable = loading || !!error || !health;
  const apiConnectionState = health ? 'connected' : error ? 'error' : 'connecting';

  /**
   * Toggle mobile drawer open/close
   */
  const handleDrawerToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  /**
   * Close drawer when navigating (mobile)
   */
  const handleNavClick = useCallback(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile]);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Header
        open={!mobileOpen}
        onMenuClick={handleDrawerToggle}
        drawerWidth={DRAWER_WIDTH}
      />
      <Sidebar
        open={!mobileOpen}
        onToggle={handleDrawerToggle}
        items={NAV_ITEMS}
        drawerWidth={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onNavClick={handleNavClick}
        health={health}
        apiConnectionState={apiConnectionState}
      />
      <MainContent drawerWidth={DRAWER_WIDTH} isMobile={isMobile}>
        <Box sx={{ position: 'relative', minHeight: 'calc(100vh - 64px)' }}>
          <Box
            sx={{
              pointerEvents: isApiUnavailable ? 'none' : 'auto',
              opacity: isApiUnavailable ? 0.35 : 1,
              transition: 'opacity 0.2s ease-in-out',
            }}
          >
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Dashboard health={health} />} />
                <Route path="/analytics" element={<Analytics servers={servers.map(s => ({ id: s.id, name: s.name }))} />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/servers" element={<Servers />} />
                <Route path="/memory" element={<Memory />} />
                <Route path="/database" element={<Database />} />
                <Route path="/playground" element={<Playground />} />
                <Route path="/logs" element={<Logs />} />
              </Routes>
            </ErrorBoundary>
          </Box>

          {isApiUnavailable && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
                textAlign: 'center',
                px: 2,
                backdropFilter: 'blur(2px)',
              }}
            >
              <CircularProgress size={36} />
              <Typography variant="h6">Trying to connect to bot API...</Typography>
              <Typography variant="body2" color="text.secondary">
                The dashboard is disabled until the bot API becomes available.
              </Typography>
            </Box>
          )}
        </Box>
      </MainContent>
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </ThemeProvider>
  );
}
