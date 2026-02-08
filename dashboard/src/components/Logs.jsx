import { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Box, Paper, Typography, Button, Stack, Chip, FormControlLabel, Switch } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

function Logs() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    ERROR: true,
    WARN: true,
    INFO: true,
    API: true,
    MESSAGE: true,
    OTHER: true
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    const socket = io();

    socket.on('logs:init', (initialLogs) => {
      setLogs(initialLogs.filter(l => l.trim()));
    });

    socket.on('log', (line) => {
      setLogs(prev => [...prev.slice(-499), line]); // Keep last 500 lines
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, filters]);

  const toggleFilter = (type) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const getLogType = (line) => {
    if (line.includes('[ERROR]')) return 'ERROR';
    if (line.includes('[WARN]')) return 'WARN';
    if (line.includes('[API]')) return 'API';
    if (line.includes('[INFO]')) return 'INFO';
    if (line.includes('[MESSAGE]')) return 'MESSAGE';
    return 'OTHER';
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(line => {
      const type = getLogType(line);
      return filters[type];
    });
  }, [logs, filters]);

  const getLevelColor = (type) => {
    switch (type) {
      case 'ERROR': return 'error.main';
      case 'WARN': return 'warning.main';
      case 'API': return 'info.main';
      case 'INFO': return 'success.main';
      case 'MESSAGE': return 'text.primary';
      default: return 'text.secondary';
    }
  };

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" color="primary">System Logs</Typography>
        
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip 
            label="ERROR" 
            size="small" 
            color="error" 
            variant={filters.ERROR ? "filled" : "outlined"} 
            onClick={() => toggleFilter('ERROR')} 
          />
          <Chip 
            label="WARN" 
            size="small" 
            color="warning" 
            variant={filters.WARN ? "filled" : "outlined"} 
            onClick={() => toggleFilter('WARN')} 
          />
          <Chip 
            label="API" 
            size="small" 
            color="info" 
            variant={filters.API ? "filled" : "outlined"} 
            onClick={() => toggleFilter('API')} 
          />
          <Chip 
            label="INFO" 
            size="small" 
            color="success" 
            variant={filters.INFO ? "filled" : "outlined"} 
            onClick={() => toggleFilter('INFO')} 
          />
           <Chip 
            label="MSG" 
            size="small" 
            color="default" 
            variant={filters.MESSAGE ? "filled" : "outlined"} 
            onClick={() => toggleFilter('MESSAGE')} 
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          <FormControlLabel
            control={
              <Switch 
                checked={autoScroll} 
                onChange={(e) => setAutoScroll(e.target.checked)} 
                size="small"
                color="primary"
              />
            }
            label={<Typography variant="caption" color="text.secondary">Auto-scroll</Typography>}
          />
          <Button 
            startIcon={<DeleteIcon />} 
            size="small" 
            onClick={() => setLogs([])}
            color="inherit"
            variant="outlined"
          >
            Clear
          </Button>
        </Stack>
      </Box>

      <Paper 
        ref={scrollRef}
        elevation={3}
        sx={{ 
          p: 2, 
          bgcolor: '#0f172a', // Darker background for logs
          color: '#f8fafc',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          flexGrow: 1,
          overflowY: 'auto',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider'
        }}
      >
        {filteredLogs.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ mt: 4 }}>
            {logs.length > 0 ? 'No logs match current filters.' : 'Waiting for logs...'}
          </Typography>
        ) : (
          filteredLogs.map((line, index) => {
            const type = getLogType(line);
            return (
              <Typography 
                key={index} 
                component="div" 
                sx={{ 
                  color: getLevelColor(type), 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  lineHeight: 1.5,
                  mb: 0.5,
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  pb: 0.5
                }}
              >
                {line}
              </Typography>
            );
          })
        )}
      </Paper>
    </Box>
  );
}

export default Logs;
