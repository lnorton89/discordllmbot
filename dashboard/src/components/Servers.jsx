import { useState, useEffect } from 'react';
import axios from 'axios';
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
  IconButton,
  Button,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Avatar
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  AddLink as AddLinkIcon,
  People as PeopleIcon
} from '@mui/icons-material';

function Row({ server, expanded, onExpand, onLeave, onEditUser, onIgnoreToggle, relationships, loadingRelationships }) {
  const isOpen = expanded === server.id;

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => onExpand(server.id)}
          >
            {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={server.iconURL} alt={server.name} variant="rounded" />
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                {server.name}
              </Typography>
              {server.memberCount && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PeopleIcon sx={{ fontSize: 12 }} /> {server.memberCount} members
                </Typography>
              )}
            </Box>
          </Box>
        </TableCell>
        <TableCell align="right">
          {server.joinedAt ? new Date(server.joinedAt).toLocaleDateString() : 'Unknown'}
        </TableCell>
        <TableCell align="right">
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={() => onLeave(server.id)}
          >
            Leave
          </Button>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                User Relationships
              </Typography>
              {loadingRelationships[server.id] ? (
                 <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                   <CircularProgress size={24} />
                 </Box>
              ) : relationships[server.id] && Object.keys(relationships[server.id]).length > 0 ? (
                <Table size="small" aria-label="purchases">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Attitude</TableCell>
                      <TableCell>Behaviors</TableCell>
                      <TableCell align="center">Ignored</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(relationships[server.id]).map(([userId, data]) => (
                      <TableRow key={userId}>
                        <TableCell component="th" scope="row">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar src={data.avatarUrl} alt={data.displayName || data.username} sx={{ width: 32, height: 32 }} />
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography variant="body2" fontWeight="medium">
                                {data.displayName || data.username || userId}
                              </Typography>
                              {data.username && data.username !== data.displayName && (
                                <Typography variant="caption" color="text.secondary">
                                  ({data.username})
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={data.attitude} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                            sx={{ height: 20, fontSize: '0.7rem' }} 
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Tooltip title={data.behavior.join(', ')}>
                            <Typography variant="body2" noWrap>
                               {data.behavior.join(', ') || 'None'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={data.ignored || false}
                            onChange={() => onIgnoreToggle(server.id, userId, data)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                           <IconButton size="small" onClick={() => onEditUser(userId, data)}>
                             <EditIcon fontSize="small" />
                           </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>No user relationships found for this server yet.</Alert>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function Servers() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [botInfo, setBotInfo] = useState(null);
  const [expandedServerId, setExpandedServerId] = useState(null);
  const [relationships, setRelationships] = useState({});
  const [loadingRelationships, setLoadingRelationships] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [editData, setEditData] = useState(null);

  useEffect(() => {
    fetchServers();
    fetchBotInfo();
  }, []);

  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/servers');
      setServers(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch servers:', err);
      setError('Failed to load server data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBotInfo = async () => {
    try {
      const response = await axios.get('/api/bot-info');
      setBotInfo(response.data);
    } catch (err) {
      console.error('Failed to fetch bot info:', err);
    }
  };

  const fetchRelationships = async (guildId) => {
    if (relationships[guildId]) return;

    setLoadingRelationships(prev => ({ ...prev, [guildId]: true }));
    try {
      const res = await axios.get(`/api/guilds/${guildId}/relationships`);
      setRelationships(prev => ({ ...prev, [guildId]: res.data }));
    } catch (err) {
      console.error(`Failed to fetch relationships for guild ${guildId}`, err);
    } finally {
      setLoadingRelationships(prev => ({ ...prev, [guildId]: false }));
    }
  };

  const toggleExpand = (guildId) => {
    if (expandedServerId === guildId) {
      setExpandedServerId(null);
    } else {
      setExpandedServerId(guildId);
      fetchRelationships(guildId);
    }
  };

  const handleLeaveServer = async (serverId) => {
    if (window.confirm(`Are you sure you want to remove the bot from server "${servers.find(s => s.id === serverId)?.name}"?`)) {
      try {
        await axios.delete(`/api/servers/${serverId}`);
        fetchServers();
      } catch (err) {
        console.error('Failed to leave server:', err);
        alert('Failed to remove bot from server');
      }
    }
  };

  const startEdit = (userId, data) => {
    setEditingUser(userId);
    setEditData({ ...data });
  };

  const handleSaveRelationship = async () => {
    if (!expandedServerId || !editingUser) return;

    try {
      await axios.post(`/api/guilds/${expandedServerId}/relationships/${editingUser}`, editData);
      
      setRelationships(prev => ({
        ...prev,
        [expandedServerId]: {
          ...prev[expandedServerId],
          [editingUser]: editData
        }
      }));
      
      setEditingUser(null);
    } catch (err) {
      console.error('Failed to save relationship', err);
      alert('Failed to save relationship changes');
    }
  };

  const handleIgnoreToggle = async (guildId, userId, currentData) => {
    const newData = { ...currentData, ignored: !currentData.ignored };
    try {
      await axios.post(`/api/guilds/${guildId}/relationships/${userId}`, newData);
      setRelationships(prev => ({
        ...prev,
        [guildId]: {
          ...prev[guildId],
          [userId]: newData
        }
      }));
    } catch (err) {
      console.error('Failed to toggle ignore status', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">Servers</Typography>
        {botInfo && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddLinkIcon />}
            href={botInfo.inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Invite Bot
          </Button>
        )}
      </Box>

      {servers.length === 0 ? (
        <Alert severity="info">The bot is not in any servers.</Alert>
      ) : (
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
          <Table aria-label="collapsible table">
            <TableHead sx={{ bgcolor: 'background.paper' }}>
              <TableRow>
                <TableCell width={50} />
                <TableCell>Server Name</TableCell>
                <TableCell align="right">Join Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {servers.map((server) => (
                <Row 
                  key={server.id} 
                  server={server} 
                  expanded={expandedServerId}
                  onExpand={toggleExpand}
                  onLeave={handleLeaveServer}
                  onEditUser={startEdit}
                  onIgnoreToggle={handleIgnoreToggle}
                  relationships={relationships}
                  loadingRelationships={loadingRelationships}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit Modal */}
      <Dialog 
        open={!!editingUser} 
        onClose={() => setEditingUser(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle>Edit Relationship</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <TextField
              label="Attitude"
              value={editData?.attitude || ''}
              onChange={(e) => setEditData({ ...editData, attitude: e.target.value })}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Behaviors (comma separated)"
              value={editData?.behavior?.join(', ') || ''}
              onChange={(e) => setEditData({ ...editData, behavior: e.target.value.split(',').map(s => s.trim()) })}
              multiline
              rows={3}
              fullWidth
              variant="outlined"
              helperText="Specific behaviors for this user"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={editData?.ignored || false}
                  onChange={(e) => setEditData({ ...editData, ignored: e.target.checked })}
                  color="primary"
                />
              }
              label="Ignore this user"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setEditingUser(null)} color="inherit">Cancel</Button>
          <Button onClick={handleSaveRelationship} variant="contained" color="primary">Save Changes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Servers;
