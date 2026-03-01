/**
 * Memory Browser Component
 * Browse and search through stored memories
 * @module pages/Memory/MemoryBrowser
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  TextField,
  List,
  ListItem,
  Chip,
  Stack,
  Pagination,
  Typography,
  Paper,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
  TrendingUp as UrgencyIcon,
  AutoAwesome as KnowledgeIcon,
} from '@mui/icons-material';
import api from '@services/api';

interface Memory {
  id: number;
  edgeType: string;
  summary: string;
  content?: string;
  urgency: number;
  createdAt: string;
  channelId: string;
  metadata?: {
    source?: string;
    url?: string;
    filename?: string;
    [key: string]: unknown;
  };
  members?: {
    nodetype: string;
    name: string;
    role: string;
  }[];
}

interface MemoryBrowserProps {
  guildId: string;
  channelId: string;
}

type SortBy = 'newest' | 'urgency';

export function MemoryBrowser({ guildId, channelId }: MemoryBrowserProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('urgency');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const memoriesPerPage = 15;

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch more memories to allow better local filtering/sorting
      const response = await api.get(`/hypergraph/${guildId}/memories`, {
        params: { channelId, minUrgency: 0, limit: 200 }
      });
      setMemories(response.data);
    } catch (error) {
      console.error('Failed to load memories', error);
    } finally {
      setLoading(false);
    }
  }, [guildId, channelId]);

  useEffect(() => {
    if (guildId) {
      loadMemories();
    }
  }, [guildId, channelId, loadMemories]);

  const processedMemories = useMemo(() => {
    let filtered = memories.filter(m =>
      m.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.content?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterType !== 'all') {
      filtered = filtered.filter(m => m.edgeType === filterType);
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return (b.urgency || 0) - (a.urgency || 0);
    });
  }, [memories, searchTerm, filterType, sortBy]);

  const paginatedMemories = processedMemories.slice(
    (page - 1) * memoriesPerPage,
    page * memoriesPerPage
  );

  const getEdgeTypeColor = (edgeType: string): 'primary' | 'success' | 'info' | 'warning' | 'default' => {
    const colors: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'default'> = {
      conversation: 'primary',
      fact: 'success',
      observation: 'info',
      relationship: 'warning',
    };
    return colors[edgeType] || 'default';
  };

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Search keywords..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              size="small"
              sx={{ bgcolor: 'background.paper' }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                label="Type"
                onChange={(e) => setFilterType(e.target.value)}
                sx={{ bgcolor: 'background.paper' }}
              >
                <MenuItem value="all">All Memories</MenuItem>
                <MenuItem value="fact">Facts (Ingested)</MenuItem>
                <MenuItem value="observation">Observations</MenuItem>
                <MenuItem value="conversation">Conversations</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 5 }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.secondary', fontWeight: 'bold' }}>SORT BY:</Typography>
              <ToggleButtonGroup
                value={sortBy}
                exclusive
                onChange={(_e, val) => val && setSortBy(val)}
                size="small"
                sx={{ bgcolor: 'background.paper' }}
              >
                <ToggleButton value="urgency">
                  <UrgencyIcon sx={{ fontSize: 18, mr: 0.5 }} /> Urgency
                </ToggleButton>
                <ToggleButton value="newest">
                  <HistoryIcon sx={{ fontSize: 18, mr: 0.5 }} /> Newest
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress size={30} sx={{ mb: 2 }} />
          <Typography color="text.secondary">Retrieving neural records...</Typography>
        </Box>
      ) : processedMemories.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography color="text.secondary">No memories match your criteria</Typography>
        </Paper>
      ) : (
        <>
          <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Showing {paginatedMemories.length} of {processedMemories.length} memories
            </Typography>
          </Box>
          <List>
            {paginatedMemories.map((memory) => (
              <MemoryListItem
                key={memory.id}
                memory={memory}
                expanded={expandedId === memory.id}
                onToggle={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
                getEdgeTypeColor={getEdgeTypeColor}
              />
            ))}
          </List>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={Math.ceil(processedMemories.length / memoriesPerPage)}
              page={page}
              onChange={(_e, value) => setPage(value)}
              color="primary"
              size="medium"
            />
          </Box>
        </>
      )}
    </Box>
  );
}

interface MemoryListItemProps {
  memory: Memory;
  expanded: boolean;
  onToggle: () => void;
  getEdgeTypeColor: (type: string) => 'primary' | 'success' | 'info' | 'warning' | 'default';
}

function MemoryListItem({ memory, expanded, onToggle, getEdgeTypeColor }: MemoryListItemProps) {
  const isIngested = memory.channelId === 'system-ingestion';
  const sourceInfo = memory.metadata?.source === 'rss' 
    ? `RSS: ${memory.metadata?.url?.split('/')[2] || 'Feed'}`
    : memory.metadata?.source === 'upload'
    ? `Doc: ${memory.metadata?.filename}`
    : null;

  return (
    <ListItem
      sx={{
        border: '1px solid',
        borderColor: expanded ? 'primary.main' : 'divider',
        borderRadius: 2,
        mb: 1.5,
        flexDirection: 'column',
        alignItems: 'flex-start',
        bgcolor: 'background.paper',
        transition: 'all 0.2s',
        boxShadow: expanded ? 2 : 0,
        '&:hover': {
          borderColor: 'primary.light',
          bgcolor: 'rgba(25, 118, 210, 0.02)'
        }
      }}
    >
      <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start', gap: 1, py: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Chip 
              label={memory.edgeType} 
              color={getEdgeTypeColor(memory.edgeType)} 
              size="small" 
              sx={{ fontWeight: 'bold', height: 20, fontSize: '0.65rem', textTransform: 'uppercase' }} 
            />
            {isIngested && (
              <Chip 
                icon={<KnowledgeIcon sx={{ fontSize: '12px !important' }} />}
                label="Ingested" 
                size="small" 
                color="secondary"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }} 
              />
            )}
            {sourceInfo && (
              <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center', fontStyle: 'italic', fontSize: '0.7rem' }}>
                {sourceInfo}
              </Typography>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="caption" sx={{ color: 'text.disabled', alignSelf: 'center' }}>
              {new Date(memory.createdAt).toLocaleDateString()} {new Date(memory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Stack>

          <Typography variant="body1" fontWeight={expanded ? 'bold' : 'medium'} sx={{ lineHeight: 1.4 }}>
            {memory.summary}
          </Typography>
        </Box>

        <IconButton size="small" onClick={onToggle} sx={{ mt: -0.5 }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
        <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
        <Box sx={{ pb: 2, width: '100%' }}>
          {memory.content && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, borderLeft: '4px solid', borderLeftColor: 'divider' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary', fontSize: '0.85rem' }}>
                {memory.content}
              </Typography>
            </Box>
          )}

          <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase' }}>
            Associated Entities
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {memory.members?.map((member, idx) => (
              <Chip
                key={idx}
                label={`${member.nodetype}: ${member.name}`}
                size="small"
                variant="outlined"
                sx={{ 
                  fontSize: '0.7rem', 
                  bgcolor: 'background.default',
                  borderColor: NODE_COLORS[member.nodetype] || 'divider',
                  '& .MuiChip-label': { px: 1 }
                }}
              />
            ))}
            {(!memory.members || memory.members.length === 0) && (
              <Typography variant="caption" color="text.disabled">No entities linked</Typography>
            )}
          </Stack>
          
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="caption" color="text.disabled" display="block">URGENCY</Typography>
              <Typography variant="body2" fontWeight="bold">{memory.urgency?.toFixed(3)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.disabled" display="block">MEMORY ID</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>#{memory.id}</Typography>
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </ListItem>
  );
}

const NODE_COLORS: Record<string, string> = {
  user: '#3b82f6',
  channel: '#10b981',
  topic: '#f59e0b',
  emotion: '#ef4444',
  event: '#8b5cf6',
  concept: '#ec4899',
};
