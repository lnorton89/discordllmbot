/**
 * Entity Manager Component
 * View and manage entities in the hypergraph
 * @module pages/Memory/EntityManager
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  TablePagination,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import api from '@services/api';

interface Node {
  id: number;
  nodeId: string;
  nodeType: string;
  name: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  memoryCount: string | number;
}

interface EntityManagerProps {
  guildId: string;
}

export function EntityManager({ guildId }: EntityManagerProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setSortBy] = useState<'name' | 'type' | 'memories'>('memories');

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hypergraph/${guildId}/nodes`);
      setNodes(response.data);
    } catch (error) {
      console.error('Failed to load nodes', error);
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (guildId) {
      loadNodes();
    }
  }, [guildId, loadNodes]);

  const filteredNodes = useMemo(() => {
    return nodes.filter(node => 
      node.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.nodeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.nodeType?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
      if (orderBy === 'memories') {
        return Number(b.memoryCount || 0) - Number(a.memoryCount || 0);
      }
      if (orderBy === 'type') {
        return (a.nodeType || '').localeCompare(b.nodeType || '');
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [nodes, searchTerm, orderBy]);

  const paginatedNodes = filteredNodes.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getNodeTypeColor = (nodeType: string): string => {
    const colors: Record<string, string> = {
      user: '#3b82f6',
      channel: '#10b981',
      topic: '#f59e0b',
      emotion: '#ef4444',
      event: '#8b5cf6',
      concept: '#ec4899',
    };
    return colors[nodeType] || '#6b7280';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={30} sx={{ mb: 2 }} />
        <Typography color="text.secondary">Loading entities...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by name, ID or type..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(0);
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={orderBy}
            label="Sort By"
            onChange={(e) => setSortBy(e.target.value as 'name' | 'type' | 'memories')}
          >
            <MenuItem value="memories">Most Memories</MenuItem>
            <MenuItem value="name">Name (A-Z)</MenuItem>
            <MenuItem value="type">Type</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Entity Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Memories</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Internal ID</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Metadata</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedNodes.map((node) => (
              <TableRow key={node.id} hover>
                <TableCell>
                  <Chip
                    label={node.nodeType}
                    size="small"
                    sx={{ 
                      bgcolor: `${getNodeTypeColor(node.nodeType)}15`,
                      color: getNodeTypeColor(node.nodeType),
                      border: `1px solid ${getNodeTypeColor(node.nodeType)}44`,
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      fontSize: '0.6rem',
                      height: 20
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">{node.name}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip 
                    label={node.memoryCount} 
                    size="small" 
                    variant="outlined"
                    sx={{ fontWeight: 'bold', height: 20 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {node.nodeId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {new Date(node.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {Object.keys(node.metadata || {}).length > 0 ? (
                    <Tooltip title={JSON.stringify(node.metadata, null, 2)}>
                      <IconButton size="small">
                        <InfoIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredNodes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">No entities found matching your search</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredNodes.length}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>
    </Box>
  );
}