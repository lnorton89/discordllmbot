/**
 * Memory Graph Page
 * @module pages/Memory/Memory
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  AccountTree as AccountTreeIcon,
  Memory as MemoryIcon,
  Hub as HubIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { serversApi } from '@services';
import type { Server } from '@types';
import { GraphVisualization } from '@pages/Memory/GraphVisualization';
import { MemoryBrowser } from '@pages/Memory/MemoryBrowser';
import { EntityManager } from '@pages/Memory/EntityManager';
import { KnowledgeIngestion } from '@pages/Memory/KnowledgeIngestion';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Memory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tabNames = ['graph', 'browser', 'entities', 'ingestion'];
  const initialTab = tabParam ? tabNames.indexOf(tabParam) : 0;

  const [tabValue, setTabValue] = useState(initialTab >= 0 && initialTab < tabNames.length ? initialTab : 0);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (selectedServer) {
      loadChannels(selectedServer);
    }
  }, [selectedServer]);

  const loadServers = async () => {
    try {
      const response = await serversApi.getServers();
      setServers(response.data);
      if (response.data.length > 0) {
        setSelectedServer(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load servers', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async (guildId: string) => {
    try {
      const response = await serversApi.getChannels(guildId);
      const serverChannels = response.data.map((ch: { id: string; name: string }) => ({ id: ch.id, name: ch.name }));

      // Always include the system ingestion channel for global knowledge
      setChannels([
        { id: 'system-ingestion', name: 'SYSTEM INGESTION (Global)' },
        ...serverChannels
      ]);

      if (serverChannels.length > 0) {
        setSelectedChannel(serverChannels[0].id);
      } else {
        setSelectedChannel('system-ingestion');
      }
    } catch (error) {
      console.error('Failed to load channels', error);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabNames[newValue]);
    setSearchParams(newParams, { replace: true });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading Memory Graph...</Typography>
      </Box>
    );
  }

  const isSystemChannel = selectedChannel === 'system-ingestion';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, pb: { xs: 8, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Memory Graph
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Explore the bot&apos;s hypergraph memory system - entities, relationships, and stored memories.
        </Typography>
      </Box>

      {/* Server & Channel Selection */}
      <Paper 
        variant="outlined" 
        sx={{ 
          p: { xs: 2, sm: 2.5 }, 
          mb: 3,
          borderRadius: 2,
        }}
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={{ xs: 2, sm: 2 }} 
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 200 } }}>
            <InputLabel id="server-select-label">Select Server</InputLabel>
            <Select
              labelId="server-select-label"
              value={selectedServer}
              label="Select Server"
              onChange={(e) => setSelectedServer(e.target.value)}
            >
              {servers.map((server) => (
                <MenuItem key={server.id} value={server.id}>
                  {server.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ width: { xs: '100%', sm: 250 }, flexGrow: { xs: 1, sm: 0 } }}>
            <InputLabel id="channel-select-label">Select Channel Source</InputLabel>
            <Select
              labelId="channel-select-label"
              value={selectedChannel}
              label="Select Channel Source"
              onChange={(e) => setSelectedChannel(e.target.value)}
              disabled={!selectedServer}
            >
              {channels.map((channel) => (
                <MenuItem
                  key={channel.id}
                  value={channel.id}
                  sx={{ 
                    color: channel.id === 'system-ingestion' ? 'secondary.main' : 'inherit', 
                    fontWeight: channel.id === 'system-ingestion' ? 'bold' : 'normal' 
                  }}
                >
                  {channel.id === 'system-ingestion' ? channel.name : `#${channel.name}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Chip
            label={isSystemChannel ? 'Ingested Knowledge' : 'Channel-scoped Memory'}
            size="small"
            color={isSystemChannel ? 'secondary' : 'info'}
            variant="outlined"
            sx={{ height: { xs: 'auto', sm: 32 } }}
          />
        </Stack>
      </Paper>

      {/* Main Content */}
      <Paper 
        variant="outlined" 
        sx={{ 
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="memory tabs"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ 
            px: { xs: 1, sm: 2 }, 
            borderBottom: 1, 
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: { xs: 56, sm: 64 },
              minWidth: { xs: 100, sm: 120 },
            }
          }}
        >
          <Tab icon={<AccountTreeIcon />} iconPosition="start" label="Graph View" />
          <Tab icon={<MemoryIcon />} iconPosition="start" label="Memory Browser" />
          <Tab icon={<HubIcon />} iconPosition="start" label="Entity Manager" />
          <Tab icon={<StorageIcon />} iconPosition="start" label="Knowledge Ingestion" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <GraphVisualization guildId={selectedServer} channelId={selectedChannel} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <MemoryBrowser guildId={selectedServer} channelId={selectedChannel} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <EntityManager guildId={selectedServer} />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <KnowledgeIngestion guildId={selectedServer} />
        </TabPanel>
      </Paper>
    </Box>
  );
}
