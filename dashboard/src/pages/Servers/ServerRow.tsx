/**
 * Server row component with expandable configuration panels.
 * @module pages/Servers/ServerRow
 */
import { useCallback } from 'react';
import type { Relationship } from '@types';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Collapse,
  TableRow,
  TableCell,
  Avatar,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Forum as ForumIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import ServerConfig from '@pages/Servers/ServerConfig';
import { formatDate } from '@utils';
import Relationships from '@pages/Servers/Relationships';
import Channels from '@pages/Servers/Channels';

/**
 * ServerRow component displaying a server with expandable configuration.
 * @param props - Component props
 * @returns Rendered server row
 */
function ServerRow({
  server,
  expanded,
  onExpand,
  onLeave,
  onEditUser,
  onIgnoreToggle,
  relationships,
  loadingRelationships,
  channels,
  loadingChannels,
  onChannelToggle,
  config,
  serverConfigs,
  loadingConfigs,
  savingConfigs,
  onConfigUpdate,
  onResetToDefault,
  serverTabs,
  onTabChange,
  relationshipPages,
  setRelationshipPages,
  relationshipRowsPerPage,
  setRelationshipRowsPerPage,
  channelPages,
  setChannelPages,
  channelRowsPerPage,
  setChannelRowsPerPage,
  isRestarting,
}) {
  const isOpen = expanded === server.id;
  const currentTab = serverTabs[server.id] || 0;
  const serverConfig = serverConfigs[server.id];

  const currentRelationshipPage = relationshipPages[server.id] || 0;
  const currentRelationshipRowsPerPage =
    relationshipRowsPerPage[server.id] || 10;
  const currentChannelPage = channelPages[server.id] || 0;
  const currentChannelRowsPerPage = channelRowsPerPage[server.id] || 10;

  const handleTabChange = (event, newValue) => {
    onTabChange(server.id, newValue);
  };

  const handleRelationshipEdit = useCallback((userId: string, data: Relationship & { avatarUrl?: string; displayName?: string; username?: string }) => {
    onEditUser(userId, data);
  }, [onEditUser]);

  const handleRelationshipIgnoreToggle = useCallback((userId: string, data: Relationship & { avatarUrl?: string; displayName?: string; username?: string }) => {
    onIgnoreToggle(server.id, userId, data);
  }, [onIgnoreToggle, server.id]);

  const handleRelationshipsPageChange = (event, newPage) => {
    setRelationshipPages((prev) => ({ ...prev, [server.id]: newPage }));
  };

  const handleRelationshipsRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRelationshipRowsPerPage((prev) => ({
      ...prev,
      [server.id]: newRowsPerPage,
    }));
    setRelationshipPages((prev) => ({ ...prev, [server.id]: 0 }));
  };

  const handleChannelsPageChange = (event, newPage) => {
    setChannelPages((prev) => ({ ...prev, [server.id]: newPage }));
  };

  const handleChannelsRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setChannelRowsPerPage((prev) => ({
      ...prev,
      [server.id]: newRowsPerPage,
    }));
    setChannelPages((prev) => ({ ...prev, [server.id]: 0 }));
  };

  return (
    <>
      <TableRow
        sx={{
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
        }}
        onClick={() => onExpand(server.id)}
      >
        <TableCell sx={{ width: 40, minWidth: 40, maxWidth: 40, padding: '4px 8px', borderBottom: 'none' }}>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onExpand(server.id);
            }}
          >
            {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row" sx={{ borderBottom: 'none', position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={server.iconURL}
              alt={server.name}
              variant="rounded"
              slotProps={{ img: { loading: 'lazy' } }}
            />
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ maxWidth: 150 }}>
                {server.name}
              </Typography>
              {server.joinedAt && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'block', sm: 'block', md: 'none' } }}
                >
                  Joined {formatDate(server.joinedAt)}
                </Typography>
              )}
              {server.memberCount && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <PeopleIcon sx={{ fontSize: 12 }} />{' '}
                  {server.memberCount - 1}{' '}
                  {server.memberCount - 1 === 1 ? 'member' : 'members'}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onLeave(server.id); }}
            aria-label={`Leave ${server.name}`}
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'red',
              display: { xs: 'inline-flex', sm: 'none' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </TableCell>
        <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
          {formatDate(server.joinedAt) || 'Unknown'}
        </TableCell>
        <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={(e) => { e.stopPropagation(); onLeave(server.id); }}
            aria-label={`Leave ${server.name}`}
          >
            Leave
          </Button>
        </TableCell>
      </TableRow>
      <TableRow sx={{ '& > *': { borderBottom: 'none' } }}>
        <td colSpan={4} style={{ paddingBottom: 0, paddingTop: 0 }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Tabs
                value={currentTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  mb: 2,
                  minHeight: 32,
                  '& .MuiTab-root': { minHeight: 32, minWidth: { xs: 80, sm: 120 } },
                }}
                aria-label="server tabs"
              >
                <Tab
                  icon={<SettingsIcon />}
                  iconPosition="start"
                  label="Server Config"
                />
                <Tab
                  icon={<PeopleIcon />}
                  iconPosition="start"
                  label="Relationships"
                />
                <Tab
                  icon={<ForumIcon />}
                  iconPosition="start"
                  label="Channels"
                />
              </Tabs>

              {/* Server Configuration Tab Panel */}
              <Box sx={{ display: currentTab !== 0 ? 'none' : 'block' }}>
                {loadingConfigs[server.id] ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress size={24} />
                    <Typography
                      variant="body2"
                      sx={{ ml: 2, alignSelf: 'center' }}
                    >
                      Loading configuration...
                    </Typography>
                  </Box>
                ) : serverConfig ? (
                  <ServerConfig
                    guildId={server.id}
                    config={serverConfig}
                    loading={loadingConfigs[server.id]}
                    saving={savingConfigs[server.id]}
                    isRestarting={isRestarting}
                    onUpdate={onConfigUpdate}
                    onReset={onResetToDefault}
                  />
                ) : (
                  <Alert severity="info">No configuration found.</Alert>
                )}
              </Box>

              {/* User Relationships Tab Panel */}
              <Box sx={{ display: currentTab !== 1 ? 'none' : 'block' }}>
                <Relationships
                  relationships={relationships[server.id] || {}}
                  loading={loadingRelationships[server.id]}
                  error={null}
                  page={currentRelationshipPage}
                  rowsPerPage={currentRelationshipRowsPerPage}
                  onPageChange={handleRelationshipsPageChange}
                  onRowsPerPageChange={handleRelationshipsRowsPerPageChange}
                  onEdit={handleRelationshipEdit}
                  onIgnoreToggle={handleRelationshipIgnoreToggle}
                />
              </Box>

              {/* Channel Monitoring Tab Panel */}
              <Box sx={{ display: currentTab !== 2 ? 'none' : 'block' }}>
                <Channels
                  guildId={server.id}
                  channels={channels[server.id]}
                  config={config}
                  serverConfig={serverConfig}
                  loading={loadingChannels[server.id]}
                  error={null}
                  page={currentChannelPage}
                  rowsPerPage={currentChannelRowsPerPage}
                  onPageChange={handleChannelsPageChange}
                  onRowsPerPageChange={handleChannelsRowsPerPageChange}
                  onToggle={onChannelToggle}
                />
              </Box>
            </Box>
          </Collapse>
        </td>
      </TableRow>
    </>
  );
}

export default ServerRow;
