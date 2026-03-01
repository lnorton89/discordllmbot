/**
 * Graph Visualization Component
 * Displays the hypergraph as an interactive force-directed network
 * @module pages/Memory/GraphVisualization
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Typography,
  Tooltip,
  IconButton,
  TextField,
  Autocomplete,
  Divider,
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  RestartAlt as ResetIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import api from '@services/api';

interface GraphNode {
  id: number;
  nodeId: string;
  nodeType: string;
  name: string;
  metadata: Record<string, unknown>;
  val?: number; // For node sizing
  color?: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: number | string | GraphNode;
  target: number | string | GraphNode;
  value: number; // For link thickness
  label: string;
  type: string;
}

interface GraphVisualizationProps {
  guildId: string;
  channelId: string;
}

const NODE_COLORS: Record<string, string> = {
  user: '#3b82f6',     // Blue
  channel: '#10b981',  // Green
  topic: '#f59e0b',    // Orange
  emotion: '#ef4444',  // Red
  event: '#8b5cf6',    // Purple
  concept: '#ec4899',  // Pink
};

const EDGE_COLORS: Record<string, string> = {
  fact: '#10b981',         // Green (Knowledge)
  observation: '#3b82f6',  // Blue
  conversation: '#6b7280', // Grey
  relationship: '#f59e0b', // Orange
};

export function GraphVisualization({ guildId, channelId }: GraphVisualizationProps) {
  const [rawData, setRawData] = useState<{ nodes: GraphNode[], edges: any[] } | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [highlightNodes, setHighlightNodes] = useState(new Set<GraphNode | string | number>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<GraphLink>());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  
  const fgRef = useRef<ForceGraphMethods>(null);

  const loadGraphData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hypergraph/${guildId}/graph`, {
        params: { channelId, limit: 400 }
      });
      setRawData(response.data);
    } catch (error) {
      console.error('Failed to load graph', error);
    } finally {
      setLoading(false);
    }
  }, [guildId, channelId]);

  useEffect(() => {
    if (guildId) {
      loadGraphData();
    }
  }, [guildId, channelId, loadGraphData]);

  // Transform raw data into graph format
  const graphData = useMemo(() => {
    if (!rawData) return { nodes: [], links: [] };

    const nodes: GraphNode[] = rawData.nodes.map((n: any) => ({
      ...n,
      color: NODE_COLORS[n.nodeType] || '#6b7280',
      val: 2, // Default base size
    }));

    const links: GraphLink[] = [];
    const nodeSet = new Set(nodes.map(n => n.id));

    rawData.edges.forEach((edge: any) => {
      const edgeNodes = (edge.connections || [])
        .map((c: any) => c.nodeid)
        .filter((id: number) => nodeSet.has(id));

      const type = edge.edgeType || 'fact';

      for (let i = 0; i < edgeNodes.length; i++) {
        for (let j = i + 1; j < edgeNodes.length; j++) {
          links.push({
            source: edgeNodes[i],
            target: edgeNodes[j],
            value: edge.importance || 1,
            label: edge.summary,
            type: type,
          });
        }
        
        const node = nodes.find(n => n.id === edgeNodes[i]);
        if (node) node.val = (node.val || 2) + 0.8;
      }
    });

    const filteredNodes = filterType === 'all' 
      ? nodes 
      : nodes.filter(n => n.nodeType === filterType);
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = links.filter(l => 
      filteredNodeIds.has(l.source as number) && filteredNodeIds.has(l.target as number)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [rawData, filterType]);

  const updateHighlight = () => {
    setHighlightNodes(new Set(highlightNodes));
    setHighlightLinks(new Set(highlightLinks));
  };

  const handleNodeHover = (node: any) => {
    highlightNodes.clear();
    highlightLinks.clear();
    if (node) {
      highlightNodes.add(node.id);
      graphData.links.forEach((link: any) => {
        if (link.source.id === node.id || link.target.id === node.id) {
          highlightLinks.add(link);
          highlightNodes.add(link.source.id);
          highlightNodes.add(link.target.id);
        }
      });
    }
    setHoverNode(node || null);
    updateHighlight();
  };

  const handleLinkHover = (link: any) => {
    highlightNodes.clear();
    highlightLinks.clear();
    if (link) {
      highlightLinks.add(link);
      highlightNodes.add(link.source.id);
      highlightNodes.add(link.target.id);
    }
    updateHighlight();
  };

  const handleNodeClick = (node: any) => {
    fgRef.current.centerAt(node.x, node.y, 1000);
    fgRef.current.zoom(3, 1000);
  };

  const handleReset = () => {
    fgRef.current.zoomToFit(400);
  };

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHighlighted = highlightNodes.has(node.id);
    const radius = Math.sqrt(node.val || 2) * (isHighlighted ? 3 : 2.5);
    
    // Draw outer glow for highlighted nodes
    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 1.5, 0, 2 * Math.PI, false);
      ctx.fillStyle = `${node.color}33`;
      ctx.fill();
    }

    // Draw main node
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Draw label if zoomed in enough or highlighted
    if (globalScale > 1.5 || isHighlighted) {
      const label = node.name;
      const fontSize = (isHighlighted ? 14 : 12) / globalScale;
      ctx.font = `${isHighlighted ? 'bold' : 'normal'} ${fontSize}px Inter, Sans-Serif`;
      
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(node.x - textWidth / 2 - 2, node.y + radius + 2, textWidth + 4, fontSize + 2);
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHighlighted ? '#fff' : 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(label, node.x, node.y + radius + 3);
    }
  }, [highlightNodes]);

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
        <CircularProgress size={40} />
        <Typography color="text.secondary">Mapping neural pathways...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Autocomplete
          size="small"
          sx={{ width: 250 }}
          options={graphData.nodes}
          getOptionLabel={(option) => option.name}
          renderInput={(params) => (
            <TextField {...params} label="Search entity..." slotProps={{ input: { ...params.InputProps, startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} /> } }} />
          )}
          onChange={(_e, node) => node && handleNodeClick(node)}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filter by Type</InputLabel>
          <Select
            value={filterType}
            label="Filter by Type"
            onChange={(e) => setFilterType(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            {Object.keys(NODE_COLORS).map(type => (
              <MenuItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={0.5} sx={{ bgcolor: 'action.hover', p: 0.5, borderRadius: 1 }}>
          <Tooltip title="Reset View">
            <IconButton onClick={handleReset} size="small"><ResetIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Zoom In">
            <IconButton onClick={() => fgRef.current.zoom(fgRef.current.zoom() * 1.5, 400)} size="small"><ZoomInIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={() => fgRef.current.zoom(fgRef.current.zoom() / 1.5, 400)} size="small"><ZoomOutIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <Chip
              key={type}
              label={type}
              size="small"
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
              sx={{
                bgcolor: filterType === 'all' || filterType === type ? color : 'transparent',
                color: filterType === 'all' || filterType === type ? 'white' : 'text.disabled',
                border: `1px solid ${color}`,
                transition: 'all 0.2s',
                '&:hover': { bgcolor: color, color: 'white' }
              }}
            />
          ))}
        </Stack>
      </Stack>

      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          height: 650,
          position: 'relative',
          overflow: 'hidden',
          bgcolor: '#0f172a',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeRelSize={6}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => 'replace'}
          linkWidth={link => (highlightLinks.has(link) ? 3 : Math.sqrt(link.value) * 0.8)}
          linkColor={link => highlightLinks.has(link) ? '#fff' : `${EDGE_COLORS[link.type] || '#ffffff22'}44`}
          linkDirectionalParticles={link => highlightLinks.has(link) ? 4 : 0}
          linkDirectionalParticleWidth={2}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          onNodeHover={handleNodeHover}
          onLinkHover={handleLinkHover}
          onNodeClick={handleNodeClick}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.2}
          cooldownTicks={100}
          onEngineStop={() => {
            if (fgRef.current) {
              fgRef.current.zoomToFit(400, 150);
            }
          }}
        />

        {/* Legend */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            pointerEvents: 'none',
          }}
        >
          <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
            Edge Types
          </Typography>
          <Stack spacing={0.5}>
            {Object.entries(EDGE_COLORS).map(([type, color]) => (
              <Stack key={type} direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>
                  {type}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Hover Info */}
        <Fade in={!!hoverNode}>
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              width: 280,
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {hoverNode && (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: hoverNode.color }}>
                    {hoverNode.name}
                  </Typography>
                  <Chip label={hoverNode.nodeType} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: hoverNode.color, color: 'white' }} />
                </Stack>
                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 1 }}>
                  ID: {hoverNode.nodeId}
                </Typography>
                {hoverNode.metadata && Object.keys(hoverNode.metadata).length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', color: 'rgba(255,255,255,0.4)' }}>METADATA</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {Object.entries(hoverNode.metadata).map(([k, v]) => (
                        <Typography key={k} variant="caption" sx={{ bgcolor: 'rgba(255,255,255,0.05)', px: 0.5, borderRadius: 0.5 }}>
                          {k}: {String(v)}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Fade>
      </Paper>
    </Box>
  );
}