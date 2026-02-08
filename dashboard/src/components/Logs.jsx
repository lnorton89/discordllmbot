import { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Api as ApiIcon,
  Chat as ChatIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';

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

  const getLogIcon = (type) => {
    switch (type) {
      case 'ERROR': return <ErrorIcon fontSize="small" />;
      case 'WARN': return <WarningIcon fontSize="small" />;
      case 'API': return <ApiIcon fontSize="small" />;
      case 'INFO': return <InfoIcon fontSize="small" />;
      case 'MESSAGE': return <ChatIcon fontSize="small" />;
      default: return <VisibilityIcon fontSize="small" />;
    }
  };

  const parseLogLine = (line) => {
    try {
      // Extract timestamp and level
      const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      const levelMatch = line.match(/\[([A-Z]+)\]/);
      
      // Find JSON object at the end of the line using a balanced bracket approach
      let braceCount = 0;
      let jsonStartIndex = -1;
      
      // Search backwards from the end to find the opening brace that balances the closing brace at the end
      for (let i = line.length - 1; i >= 0; i--) {
        if (line[i] === '}') {
          braceCount++;
        } else if (line[i] === '{') {
          braceCount--;
          if (braceCount === 0) {
            jsonStartIndex = i;
            break;
          }
        }
      }
      
      if (jsonStartIndex !== -1) {
        const textPart = line.substring(0, jsonStartIndex).trim();
        const jsonPart = line.substring(jsonStartIndex);
        
        try {
          const jsonObject = JSON.parse(jsonPart);
          return {
            timestamp: timestampMatch ? timestampMatch[1] : null,
            level: levelMatch ? levelMatch[1] : 'OTHER',
            text: textPart,
            json: jsonObject
          };
        } catch (e) {
          // If JSON parsing fails, return the whole line as text
          return {
            timestamp: timestampMatch ? timestampMatch[1] : null,
            level: levelMatch ? levelMatch[1] : 'OTHER',
            text: line,
            json: null
          };
        }
      } else {
        // If no JSON object found, return the whole line as text
        return {
          timestamp: timestampMatch ? timestampMatch[1] : null,
          level: levelMatch ? levelMatch[1] : 'OTHER',
          text: line,
          json: null
        };
      }
    } catch (e) {
      return {
        timestamp: null,
        level: 'OTHER',
        text: line,
        json: null
      };
    }
  };

  const formatJsonForDisplay = (obj, depth = 0) => {
    const indent = '\u00A0'.repeat(depth * 4); // Non-breaking space for indentation
    
    if (typeof obj !== 'object' || obj === null) {
      return (
        <Typography component="span" sx={{ color: 'text.primary', fontFamily: 'monospace' }}>
          {JSON.stringify(obj)}
        </Typography>
      );
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return <Typography component="span">[]</Typography>;
      
      return (
        <Box component="div" sx={{ ml: 2 }}>
          <Typography component="span" sx={{ color: 'text.secondary' }}>[</Typography>
          {obj.map((item, index) => (
            <Box key={index} component="div" sx={{ ml: 2 }}>
              <Typography component="span">{indent}<strong>{index}:</strong> </Typography>
              {formatJsonForDisplay(item, depth + 1)}
              {index < obj.length - 1 && <br />}
            </Box>
          ))}
          <Typography component="span" sx={{ color: 'text.secondary' }}>]</Typography>
        </Box>
      );
    }

    const entries = Object.entries(obj);
    if (entries.length === 0) return <Typography component="span">{{}}</Typography>;

    return (
      <Box component="div" sx={{ ml: 2 }}>
        <Typography component="span" sx={{ color: 'text.secondary' }}>{'{'} </Typography>
        {entries.map(([key, value], index) => (
          <Box key={key} component="div" sx={{ ml: 2 }}>
            <Typography component="span">
              {indent}<strong>"{key}"</strong>: 
            </Typography>{' '}
            {formatJsonForDisplay(value, depth + 1)}
            {index < entries.length - 1 && <Typography component="span">,</Typography>}
            <br />
          </Box>
        ))}
        <Typography component="span" sx={{ color: 'text.secondary' }}>{'}'}</Typography>
      </Box>
    );
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
            icon={getLogIcon('ERROR')}
          />
          <Chip
            label="WARN"
            size="small"
            color="warning"
            variant={filters.WARN ? "filled" : "outlined"}
            onClick={() => toggleFilter('WARN')}
            icon={getLogIcon('WARN')}
          />
          <Chip
            label="API"
            size="small"
            color="info"
            variant={filters.API ? "filled" : "outlined"}
            onClick={() => toggleFilter('API')}
            icon={getLogIcon('API')}
          />
          <Chip
            label="INFO"
            size="small"
            color="success"
            variant={filters.INFO ? "filled" : "outlined"}
            onClick={() => toggleFilter('INFO')}
            icon={getLogIcon('INFO')}
          />
          <Chip
            label="MSG"
            size="small"
            color="default"
            variant={filters.MESSAGE ? "filled" : "outlined"}
            onClick={() => toggleFilter('MESSAGE')}
            icon={getLogIcon('MESSAGE')}
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
            const parsedLog = parseLogLine(line);
            const type = parsedLog.level;
            const hasJson = !!parsedLog.json;
            
            return (
              <Accordion 
                key={index} 
                sx={{ 
                  bgcolor: 'transparent', 
                  boxShadow: 'none',
                  border: 'none',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': { margin: 0 },
                  mb: 0.5
                }}
              >
                <AccordionSummary
                  expandIcon={hasJson ? <ExpandMoreIcon sx={{ color: 'text.secondary' }} /> : null}
                  sx={{
                    padding: 0,
                    minHeight: 'auto',
                    '& .MuiAccordionSummary-content': {
                      margin: 0
                    },
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.03)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                    <Tooltip title={type} placement="top">
                      <Box sx={{ mr: 1, display: 'flex', alignItems: 'flex-start', pt: 0.5 }}>
                        {getLogIcon(type)}
                      </Box>
                    </Tooltip>
                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <Typography
                        component="span"
                        sx={{
                          color: getLevelColor(type),
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          lineHeight: 1.5,
                          display: 'inline'
                        }}
                      >
                        {parsedLog.text}
                      </Typography>
                      {hasJson && (
                        <Box component="div" sx={{ 
                          mt: 0.5, 
                          ml: 3, 
                          pl: 1, 
                          borderLeft: '2px solid',
                          borderLeftColor: 'divider',
                          fontSize: '0.75rem',
                          color: 'text.secondary'
                        }}>
                          {Object.entries(parsedLog.json).slice(0, 3).map(([key, value]) => (
                            <Typography 
                              key={key} 
                              component="span" 
                              sx={{ display: 'block', mb: 0.5 }}
                            >
                              <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </Typography>
                          ))}
                          {Object.keys(parsedLog.json).length > 3 && (
                            <Typography component="span" sx={{ fontStyle: 'italic' }}>
                              ... and {Object.keys(parsedLog.json).length - 3} more fields
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </AccordionSummary>
                
                {hasJson && (
                  <AccordionDetails sx={{ 
                    padding: '8px 0 0 24px', 
                    bgcolor: 'rgba(0,0,0,0.1)',
                    borderTop: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <Box component="div" sx={{ 
                      color: '#cbd5e1',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.4
                    }}>
                      {formatJsonForDisplay(parsedLog.json)}
                    </Box>
                  </AccordionDetails>
                )}
              </Accordion>
            );
          })
        )}
      </Paper>
    </Box>
  );
}

export default Logs;
