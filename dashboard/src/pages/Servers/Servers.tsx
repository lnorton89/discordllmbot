/**
 * Servers page for managing Discord servers the bot is in.
 * @module pages/Servers/Servers
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  TableCell,
  Paper,
} from '@mui/material';
import { AddLink as AddLinkIcon } from '@mui/icons-material';

import { useServers, useSocketContext } from '@hooks';
import { serversApi, configApi } from '@services';
import { isChannelIgnored, deepClone } from '@utils';
import { EmptyState, ErrorBoundary } from '@components/common';
import { ServerRow, EditRelationshipDialog } from '@pages/Servers';
import type { BotConfig } from '@types';

/**
 * Servers page component displaying all Discord servers the bot has joined.
 * Allows configuration, relationship management, and channel monitoring per server.
 * @returns Rendered servers page
 */
function Servers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const expandedParam = searchParams.get('expanded');

  // ===========================================================================
  // HOOKS: Get server list and socket state
  // ===========================================================================
  const { servers, botInfo, loading, error, leaveServer } = useServers();
  const { isRestarting } = useSocketContext();

  // ===========================================================================
  // STATE: Server list and configuration
  // ===========================================================================
  // Global config - shared across all servers, used as fallback
  const [config, setConfig] = useState<BotConfig | null>(null);
  
  // Currently expanded server (for collapsible row)
  const [expandedServerId, setExpandedServerId] = useState<string | null>(expandedParam);
  
  // Tab selection per server (0=Config, 1=Relationships, 2=Channels)
  const [serverTabs, setServerTabs] = useState({});
  
  // Pagination state for relationships table (per server)
  const [relationshipPages, setRelationshipPages] = useState({});
  const [relationshipRowsPerPage, setRelationshipRowsPerPage] = useState({});
  // Pagination state for channels table (per server)
  const [channelPages, setChannelPages] = useState({});
  const [channelRowsPerPage, setChannelRowsPerPage] = useState({});
  
  // Edit dialog state for relationship editing
  const [editingUser, setEditingUser] = useState(null);
  const [editData, setEditData] = useState(null);
  
  // Snackbar message state for user feedback
  const [message, setMessage] = useState({
    open: false,
    text: '',
    severity: 'success',
  });

  // ===========================================================================
  // STATE: Server-specific data (lazy-loaded when expanded)
  // ===========================================================================
  // Per-server configuration overrides
  const [serverConfigs, setServerConfigs] = useState({});
  const [loadingConfigs, setLoadingConfigs] = useState({});
  const [savingConfigs, setSavingConfigs] = useState({});
  
  // Per-server user relationships (username, attitude, behavior, etc.)
  const [relationships, setRelationships] = useState({});
  const [loadingRelationships, setLoadingRelationships] = useState({});
  
  // Per-server channel list for monitoring toggle
  const [channels, setChannels] = useState({});
  const [loadingChannels, setLoadingChannels] = useState({});

  // Debounce timers for auto-save (per server)
  const debounceTimers = useRef({});

  // ===========================================================================
  // EFFECT: Fetch global config on mount
  // ===========================================================================
  // Global config serves as defaults when server-specific config doesn't exist
  const fetchConfig = useCallback(async () => {
    try {
      const response = await configApi.getConfig();
      setConfig(response.data as BotConfig);
    } catch {
      // Silently fail - will use defaults
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Sync expanded server with URL - clear if server no longer exists
  useEffect(() => {
    if (expandedServerId && servers.length > 0) {
      const serverExists = servers.some((s) => s.id === expandedServerId);
      if (!serverExists) {
        setExpandedServerId(null);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('expanded');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [expandedServerId, servers, searchParams, setSearchParams]);

  // ===========================================================================
  // HANDLERS: Server row expansion
  // ===========================================================================
  // Toggles expanded state, resets to first tab when opening
  const toggleExpand = useCallback((guildId) => {
    if (expandedServerId === guildId) {
      setExpandedServerId(null);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('expanded');
      setSearchParams(newParams, { replace: true });
    } else {
      setExpandedServerId(guildId);
      setServerTabs((prev) => ({ ...prev, [guildId]: 0 }));
      const newParams = new URLSearchParams(searchParams);
      newParams.set('expanded', guildId);
      setSearchParams(newParams, { replace: true });
    }
  }, [expandedServerId, searchParams, setSearchParams]);

  // ===========================================================================
  // HANDLERS: Server actions
  // ===========================================================================
  // Remove bot from server
  const handleLeaveServer = async (serverId) => {
    const server = servers.find((s) => s.id === serverId);
    if (
      window.confirm(
        `Are you sure you want to remove the bot from server "${server?.name}"?`
      )
    ) {
      try {
        await leaveServer(serverId);
      } catch {
        setMessage({
          open: true,
          text: 'Failed to remove bot from server',
          severity: 'error',
        });
      }
    }
  };

  // Switch between Config/Relationships/Channels tabs
  const handleTabChange = useCallback((guildId, tabIndex) => {
    setServerTabs((prev) => ({ ...prev, [guildId]: tabIndex }));
  }, []);

  // Open edit dialog for a user relationship
  const startEdit = useCallback((userId, data) => {
    setEditingUser(userId);
    setEditData({ ...data });
  }, []);

  // Save relationship changes to API and update local state
  const handleSaveRelationship = async (guildId, userId, data) => {
    try {
      await serversApi.updateRelationship(guildId, userId, data);
      setRelationships((prev) => ({
        ...prev,
        [guildId]: {
          ...prev[guildId],
          [userId]: data,
        },
      }));
      setEditingUser(null);
    } catch {
      setMessage({
        open: true,
        text: 'Failed to save relationship changes',
        severity: 'error',
      });
    }
  };

  // Toggle user's ignore flag (prevents bot from responding to them)
  const handleIgnoreToggle = async (guildId, userId, currentData) => {
    const newData = { ...currentData, ignored: !currentData.ignored };
    try {
      await serversApi.updateRelationship(guildId, userId, newData);
      setRelationships((prev) => ({
        ...prev,
        [guildId]: {
          ...prev[guildId],
          [userId]: newData,
        },
      }));
    } catch {
      // Silently fail
    }
  };

  // Toggle channel monitoring: add/remove from allowed or ignored list
  const handleChannelToggle = async (guildId, channelId) => {
    let currentServerConfig = serverConfigs[guildId];
    
    if (!currentServerConfig) {
      try {
        const response = await serversApi.getServerConfig(guildId);
        currentServerConfig = response.data;
      } catch {
        currentServerConfig = {
          nickname: '',
          speakingStyle: ['helpful', 'polite', 'concise'],
          replyBehavior: {
            replyProbability: 1,
            minDelayMs: 500,
            maxDelayMs: 3000,
            mentionOnly: true,
            guildSpecificChannels: {},
          },
        };
      }
    }

    const updatedServerConfig = deepClone(currentServerConfig);

    if (!updatedServerConfig.replyBehavior.guildSpecificChannels) {
      updatedServerConfig.replyBehavior.guildSpecificChannels = {};
    }

    if (!updatedServerConfig.replyBehavior.guildSpecificChannels[guildId]) {
      updatedServerConfig.replyBehavior.guildSpecificChannels[guildId] = {
        allowed: [],
        ignored: [],
      };
    }

    const guildChannels = updatedServerConfig.replyBehavior.guildSpecificChannels[guildId];
    const isCurrentlyMonitored = !isChannelIgnored(currentServerConfig, guildId, channelId);

    if (isCurrentlyMonitored) {
      if (guildChannels.allowed && guildChannels.allowed.length > 0) {
        guildChannels.allowed = guildChannels.allowed.filter((id) => id !== channelId);
      } else {
        if (!guildChannels.ignored) guildChannels.ignored = [];
        if (!guildChannels.ignored.includes(channelId)) {
          guildChannels.ignored.push(channelId);
        }
      }
    } else {
      if (guildChannels.ignored) {
        guildChannels.ignored = guildChannels.ignored.filter((id) => id !== channelId);
      }

      if (guildChannels.allowed && Array.isArray(guildChannels.allowed)) {
        if (!guildChannels.allowed.includes(channelId)) {
          guildChannels.allowed.push(channelId);
        }
      }
    }

    try {
      await serversApi.updateServerConfig(guildId, updatedServerConfig);
      setServerConfigs((prev) => ({ ...prev, [guildId]: updatedServerConfig }));
      setMessage({
        open: true,
        text: 'Channel settings updated',
        severity: 'success',
      });
    } catch {
      setMessage({
        open: true,
        text: 'Failed to update channel monitoring settings',
        severity: 'error',
      });
    }
  };

  // Auto-save server config with 1.5s debounce to prevent API spam
  const handleConfigUpdate = useCallback((guildId, newConfig) => {
    if (isRestarting) return;

    if (debounceTimers.current[guildId]) {
      clearTimeout(debounceTimers.current[guildId]);
    }

    debounceTimers.current[guildId] = setTimeout(async () => {
      try {
        await serversApi.updateServerConfig(guildId, newConfig);
        setServerConfigs((prev) => ({ ...prev, [guildId]: newConfig }));
        setSavingConfigs((prev) => ({ ...prev, [guildId]: false }));
        setMessage({
          open: true,
          text: 'Settings saved automatically',
          severity: 'success',
        });
      } catch {
        setSavingConfigs((prev) => ({ ...prev, [guildId]: false }));
        setMessage({
          open: true,
          text: 'Failed to save settings',
          severity: 'error',
        });
      }
    }, 1500);
  }, [isRestarting]);

  // Reset server config to global defaults
  const handleResetToDefault = async (guildId) => {
    if (window.confirm('Reset this server\'s configuration to default?')) {
      try {
        await serversApi.resetServerConfig(guildId);
        const response = await serversApi.getServerConfig(guildId);
        setServerConfigs((prev) => ({ ...prev, [guildId]: response.data }));
        setMessage({
          open: true,
          text: 'Configuration reset to default',
          severity: 'info',
        });
      } catch {
        // Handle error
      }
    }
  };

  // ===========================================================================
  // EFFECT: Lazy-load server data when expanded
  // ===========================================================================
  // Fetches config, relationships, and channels only when user expands a server row
  // This avoids loading unnecessary data for servers the user isn't interacting with
  useEffect(() => {
    if (!expandedServerId) return;

    const fetchServerData = async () => {
      // Fetch config
      if (!serverConfigs[expandedServerId] && !loadingConfigs[expandedServerId]) {
        setLoadingConfigs((prev) => ({ ...prev, [expandedServerId]: true }));
        try {
          const response = await serversApi.getServerConfig(expandedServerId);
          setServerConfigs((prev) => ({ ...prev, [expandedServerId]: response.data }));
        } catch {
          // Handle error
        } finally {
          setLoadingConfigs((prev) => ({ ...prev, [expandedServerId]: false }));
        }
      }

      // Fetch relationships
      if (!relationships[expandedServerId] && !loadingRelationships[expandedServerId]) {
        setLoadingRelationships((prev) => ({ ...prev, [expandedServerId]: true }));
        try {
          const response = await serversApi.getRelationships(expandedServerId);
          setRelationships((prev) => ({ ...prev, [expandedServerId]: response.data }));
        } catch {
          setRelationships((prev) => ({ ...prev, [expandedServerId]: {} }));
        } finally {
          setLoadingRelationships((prev) => ({ ...prev, [expandedServerId]: false }));
        }
      }

      // Fetch channels
      if (!channels[expandedServerId] && !loadingChannels[expandedServerId]) {
        setLoadingChannels((prev) => ({ ...prev, [expandedServerId]: true }));
        try {
          const response = await serversApi.getChannels(expandedServerId);
          setChannels((prev) => ({ ...prev, [expandedServerId]: response.data }));
        } catch {
          setChannels((prev) => ({ ...prev, [expandedServerId]: [] }));
        } finally {
          setLoadingChannels((prev) => ({ ...prev, [expandedServerId]: false }));
        }
      }
    };

    fetchServerData();
  }, [expandedServerId, serverConfigs, loadingConfigs, relationships, loadingRelationships, channels, loadingChannels]);

  // Close the snackbar notification
  const closeMessage = () => {
    setMessage({ ...message, open: false });
  };

  // ===========================================================================
  // RENDER: Loading and error states
  // ===========================================================================
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
        {error.message || 'Failed to load server data'}
      </Alert>
    );
  }

  // ===========================================================================
  // RENDER: Main table
  // ===========================================================================
  return (
    <ErrorBoundary>
      <Box sx={{ width: '100%', pb: 2 }}>
        {servers.length === 0 ? (
          <EmptyState
            title="No Servers"
            message="The bot is not in any servers yet."
          />
        ) : (
          <Paper elevation={2} sx={{ borderRadius: 2, overflowX: 'auto' }}>
            <Table 
              aria-label="collapsible table" 
              sx={{ 
                tableLayout: 'fixed',
                minWidth: { xs: 0, sm: 600 },
              }}
            >
              <TableHead sx={{ display: { xs: 'none', sm: 'table-header-group' } }}>
                <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                  <TableCell sx={{ width: 40, minWidth: 40, maxWidth: 40, padding: '4px 8px' }} />
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Server
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                      Joined
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 40 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                      Actions
                    </Box>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ '& > *': { borderBottom: 'unset' } }}>
                {servers.map((server) => (
                  <ServerRow
                    key={server.id}
                    server={server}
                    expanded={expandedServerId}
                    onExpand={toggleExpand}
                    onLeave={handleLeaveServer}
                    onEditUser={startEdit}
                    onIgnoreToggle={handleIgnoreToggle}
                    relationships={relationships}
                    loadingRelationships={loadingRelationships}
                    channels={channels}
                    loadingChannels={loadingChannels}
                    onChannelToggle={handleChannelToggle}
                    config={config}
                    serverConfigs={serverConfigs}
                    loadingConfigs={loadingConfigs}
                    savingConfigs={savingConfigs}
                    onConfigUpdate={handleConfigUpdate}
                    onResetToDefault={handleResetToDefault}
                    serverTabs={serverTabs}
                    onTabChange={handleTabChange}
                    relationshipPages={relationshipPages}
                    setRelationshipPages={setRelationshipPages}
                    relationshipRowsPerPage={relationshipRowsPerPage}
                    setRelationshipRowsPerPage={setRelationshipRowsPerPage}
                    channelPages={channelPages}
                    setChannelPages={setChannelPages}
                    channelRowsPerPage={channelRowsPerPage}
                    setChannelRowsPerPage={setChannelRowsPerPage}
                    isRestarting={isRestarting}
                  />
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {/* Invite Bot Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          {botInfo && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddLinkIcon />}
              href={botInfo.inviteUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Invite Bot
            </Button>
          )}
        </Box>

        {/* Edit Dialog */}
        {editingUser && expandedServerId && (
          <EditRelationshipDialog
            key={editingUser}
            open={!!editingUser}
            userId={editingUser}
            data={editData || undefined}
            onClose={() => setEditingUser(null)}
            onSave={(userId, data) => handleSaveRelationship(expandedServerId, userId, data)}
          />
        )}

        <Snackbar
          open={message.open}
          autoHideDuration={3000}
          onClose={closeMessage}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            severity={message.severity as 'success' | 'error' | 'warning' | 'info'}
            variant="filled"
            onClose={closeMessage}
          >
            {message.text}
          </Alert>
        </Snackbar>
      </Box>
    </ErrorBoundary>
  );
}

export default Servers;
