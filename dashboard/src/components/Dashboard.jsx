import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CircularProgress,
  Avatar,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Message as MessageIcon,
  People as PeopleIcon,
  Dns as ServerIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';

function StatCard({ title, value, icon, color }) {
  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 3 }}>
        <Box sx={{
          p: 1.5,
          borderRadius: 3,
          bgcolor: `${color}.light`,
          color: `${color}.contrastText`,
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {icon}
        </Box>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight="medium">
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Dashboard({ health }) {
  const [stats, setStats] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    
    const dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
    const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, repliesRes] = await Promise.all([
        axios.get('/api/analytics'),
        axios.get('/api/replies?limit=10') // Increased limit for more activity
      ]);
      setStats(analyticsRes.data);
      setReplies(repliesRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom sx={{ mb: 3 }}>
        Dashboard Overview
      </Typography>

      <TableContainer component={Paper} elevation={2}>
        <Table aria-label="dashboard stats table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Metric</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Value</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Uptime</TableCell>
              <TableCell align="right">{formatUptime(health?.uptime)}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Total Replies (24h)</TableCell>
              <TableCell align="right">{stats?.stats24h?.total_replies || 0}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Active Servers (24h)</TableCell>
              <TableCell align="right">{stats?.stats24h?.active_servers || 0}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Active Users (24h)</TableCell>
              <TableCell align="right">{stats?.stats24h?.active_users || 0}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Activity Volume (7 Days)</TableCell>
              <TableCell align="right" sx={{ width: '70%' }}>
                <Box sx={{ height: 200, p: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.volume || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#94a3b8', fontSize: 12 }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      />
                      <YAxis 
                        tick={{ fill: '#94a3b8', fontSize: 12 }} 
                        axisLine={false} 
                        tickLine={false}
                      />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                        itemStyle={{ color: '#f8fafc' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Replies" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Top Servers (All Time)</TableCell>
              <TableCell align="right">
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Rank</TableCell>
                        <TableCell>Server Name</TableCell>
                        <TableCell align="right">Replies</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats?.topServers?.map((server, index) => (
                        <TableRow key={server.guildname}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{server.guildname}</TableCell>
                          <TableCell align="right">{server.reply_count}</TableCell>
                        </TableRow>
                      ))}
                      {(!stats?.topServers || stats.topServers.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} align="center"><Typography color="text.secondary">No data yet.</Typography></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Bottom Row: Recent Activity */}
      <Grid item xs={12} sx={{ mt: 3 }}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>Latest Activity</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {replies.length === 0 ? (
               <Alert severity="info">No recent activity.</Alert>
            ) : (
               replies.map((reply) => (
                 <Paper key={reply.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.default', borderColor: 'divider' }}>
                   <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                     <Avatar 
                       src={reply.avatarurl || undefined} 
                       alt={reply.displayname}
                       sx={{ width: 40, height: 40 }}
                     />
                     <Box sx={{ flexGrow: 1 }}>
                       <Typography variant="subtitle2" component="div" fontWeight="bold">
                         {reply.displayname || reply.username}
                       </Typography>
                       <Typography variant="caption" color="text.secondary">
                         in {reply.guildname}
                       </Typography>
                     </Box>
                     <Typography variant="caption" color="text.secondary">
                       {new Date(reply.timestamp).toLocaleTimeString()}
                     </Typography>
                   </Box>
  
                   <Grid container spacing={3}>
                     <Grid item xs={12} md={6}>
                       <Typography variant="body2" color="text.primary" sx={{ fontStyle: 'italic', pl: 1.5, borderLeft: '3px solid', borderColor: 'text.disabled' }}>
                         "{reply.usermessage}"
                       </Typography>
                     </Grid>
                     <Grid item xs={12} md={6}>
                       <Typography variant="body2" color="text.primary" sx={{ pl: 1.5, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                         {reply.botreply}
                       </Typography>
                     </Grid>
                   </Grid>
                 </Paper>
               ))
            )}
          </Box>
        </Paper>
      </Grid>
    </Box>
  );
}

export default Dashboard;
