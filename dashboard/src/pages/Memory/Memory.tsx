/**
 * Memory Graph Page
 * @module pages/Memory/Memory
 */
import React, { useState, useEffect } from 'react';
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
import { GraphVisualization } from './GraphVisualization';
import { MemoryBrowser } from './MemoryBrowser';
import { EntityManager } from './EntityManager';
import { KnowledgeIngestion } from './KnowledgeIngestion';

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
  const [tabValue, setTabValue] = useState(0);
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
      const serverChannels = response.data.map((ch: any) => ({ id: ch.id, name: ch.name }));
      
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
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Memory Graph
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Explore the bot's hypergraph memory system - entities, relationships, and stored memories.
      </Typography>

      {/* Server & Channel Selection */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Select Server</InputLabel>
            <Select
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

          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Select Channel Source</InputLabel>
            <Select
              value={selectedChannel}
              label="Select Channel Source"
              onChange={(e) => setSelectedChannel(e.target.value)}
              disabled={!selectedServer}
            >
              {channels.map((channel) => (
                <MenuItem 
                  key={channel.id} 
                  value={channel.id}
                  sx={{ color: channel.id === 'system-ingestion' ? 'secondary.main' : 'inherit', fontWeight: channel.id === 'system-ingestion' ? 'bold' : 'normal' }}
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
          />
        </Stack>
      </Paper>

      {/* Main Content */}
      <Paper variant="outlined">
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="memory tabs"
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<AccountTreeIcon />} label="Graph View" />
          <Tab icon={<MemoryIcon />} label="Memory Browser" />
          <Tab icon={<HubIcon />} label="Entity Manager" />
          <Tab icon={<StorageIcon />} label="Knowledge Ingestion" />
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
