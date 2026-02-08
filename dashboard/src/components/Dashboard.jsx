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
  Chip,
  Skeleton,
  Stack,
  LinearProgress
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  Message as MessageIcon,
  People as PeopleIcon,
  Dns as ServerIcon,
  AccessTime as AccessTimeIcon,
  Speed as SpeedIcon,
  DataUsage as DataUsageIcon,
  TrendingUp as TrendingUpIcon,
  Token as TokenIcon
} from '@mui/icons-material';

// Improved StatCard component with better visual hierarchy
function StatCard({ title, value, icon, color, loading = false, trend = null }) {
  return (
    <Card 
      elevation={3} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6
        }
      }}
    >
      <CardContent sx={{ p: 3, flex: 1 }}>
        {loading ? (
          <Stack spacing={2}>
            <Skeleton variant="circular" width={48} height={48} />
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="80%" height={32} />
          </Stack>
        ) : (
          <>
            <Box sx={{
              p: 1.5,
              borderRadius: 3,
              bgcolor: `${color}.light`,
              color: `${color}.contrastText`,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56
            }}>
              {icon}
            </Box>
            <Typography 
              variant="h4" 
              fontWeight="bold" 
              sx={{ 
                mb: 1,
                lineHeight: 1.2
              }}
            >
              {value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                fontWeight="medium"
              >
                {title}
              </Typography>
              {trend !== null && (
                <Chip 
                  label={`${trend >= 0 ? '+' : ''}${trend}%`}
                  size="small"
                  color={trend >= 0 ? 'success' : 'error'}
                  icon={trend >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingUpIcon fontSize="small" sx={{ transform: 'rotate(180deg)' }} />}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard({ health }) {
  const [stats, setStats] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setLoading(true);
      setError(null);
      
      const [analyticsRes, repliesRes] = await Promise.all([
        axios.get('/api/analytics'),
        axios.get('/api/replies?limit=5') // Increased limit for more activity
      ]);
      
      setStats(analyticsRes.data);
      setReplies(repliesRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      setError('Failed to load dashboard data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate trends if available
  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  };

  if (loading && !stats) {
    return (
      <Box sx={{ width: '100%', py: 4 }}>
        <Skeleton variant="text" width="30%" height={40} sx={{ mb: 4 }} />
        
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[...Array(4)].map((_, idx) => (
            <Grid item xs={12} sm={6} md={3} key={idx}>
              <StatCard 
                title="Loading..." 
                value="0" 
                icon={<MessageIcon />}
                color="primary"
                loading={true}
              />
            </Grid>
          ))}
        </Grid>
        
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Paper elevation={3} sx={{ p: 3, height: 300 }}>
              <Skeleton variant="text" width="40%" height={30} sx={{ mb: 3 }} />
              <Skeleton variant="rectangular" height={200} />
            </Paper>
          </Grid>
          <Grid item xs={12} lg={4}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Skeleton variant="text" width="60%" height={30} sx={{ mb: 3 }} />
              <Stack spacing={2}>
                {[...Array(3)].map((_, idx) => (
                  <Skeleton key={idx} variant="rectangular" height={60} />
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error && !stats) {
    return (
      <Box sx={{ width: '100%', py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Unable to Load Dashboard Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            There was an issue connecting to the API. Please try again.
          </Typography>
          <Chip 
            label="Retry Connection" 
            color="primary" 
            onClick={fetchData}
            sx={{ cursor: 'pointer', mt: 1 }}
          />
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', py: 3 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
          Dashboard Overview
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor your Discord LLM Bot performance and activity
        </Typography>
      </Box>

      {/* Stats Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Replies (24h)"
            value={stats?.stats24h?.total_replies || 0}
            icon={<MessageIcon />}
            color="primary"
            trend={calculateTrend(stats?.stats24h?.total_replies, stats?.statsPrevious24h?.total_replies)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Servers (24h)"
            value={stats?.stats24h?.active_servers || 0}
            icon={<ServerIcon />}
            color="secondary"
            trend={calculateTrend(stats?.stats24h?.active_servers, stats?.statsPrevious24h?.active_servers)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Users (24h)"
            value={stats?.stats24h?.active_users || 0}
            icon={<PeopleIcon />}
            color="info"
            trend={calculateTrend(stats?.stats24h?.active_users, stats?.statsPrevious24h?.active_users)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tokens Used (24h)"
            value={stats?.stats24h?.total_tokens || 0}
            icon={<TokenIcon />}
            color="success"
            trend={calculateTrend(
              stats?.stats24h?.total_tokens,
              stats?.statsPrevious24h?.total_tokens
            )}
          />
        </Grid>
      </Grid>

      {/* Main Content Grid - Activity Chart, Top Servers, and System Health */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Activity Chart - Takes up 2/3 of the space on large screens */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={3} sx={{ p: 3, height: 350 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="bold">
                Activity Volume (7 Days)
              </Typography>
              <Chip 
                label="Last 7 days" 
                size="small" 
                variant="outlined" 
                sx={{ borderRadius: 4 }}
              />
            </Box>
            
            {stats?.volume && stats.volume.length > 0 ? (
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={stats.volume}>
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
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155', 
                      borderRadius: 8,
                      color: '#f8fafc'
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                    name="Replies" 
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'text.secondary'
              }}>
                <Typography>No activity data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Column - Top Servers and System Health stacked on top of each other */}
        <Grid item xs={12} lg={4}>
          {/* Top Servers */}
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Top Servers (All Time)
            </Typography>
            
            {stats?.topServers && stats.topServers.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Server</TableCell>
                      <TableCell align="right">Replies</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.topServers.slice(0, 5).map((server, index) => (
                      <TableRow key={server.guildname}>
                        <TableCell>
                          <Chip 
                            label={index + 1} 
                            size="small" 
                            color={index < 3 ? "primary" : "default"}
                            sx={{ minWidth: 24 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar 
                              src={server.icon_url || undefined} 
                              alt={server.guildname} 
                              sx={{ width: 24, height: 24 }}
                            >
                              {server.guildname.charAt(0)}
                            </Avatar>
                            <Typography variant="body2" noWrap maxWidth={120}>
                              {server.guildname}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {server.reply_count}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">No server data available</Typography>
              </Box>
            )}
          </Paper>

          {/* System Health */}
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              System Health
            </Typography>
            
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">API Status</Typography>
                <Chip 
                  label={health?.status || 'Unknown'} 
                  size="small"
                  color={health?.status === 'ok' ? 'success' : 'error'}
                  sx={{ height: 24 }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Uptime</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatUptime(health?.uptime)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Memory Usage</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {health?.memory_usage ? `${Math.round(health.memory_usage)}%` : 'N/A'}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">CPU Usage</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {health?.cpu_usage ? `${Math.round(health.cpu_usage)}%` : 'N/A'}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Latest Activity - Full width to maximize space */}
      <Grid item xs={12}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
            Latest Activity
          </Typography>
          
          {replies.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No recent activity to display.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {replies.map((reply) => (
                <Paper 
                  key={reply.id} 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    borderRadius: 2,
                    bgcolor: 'background.default',
                    borderColor: 'divider',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 2
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
                    <Avatar
                      src={reply.avatarurl || undefined}
                      alt={reply.displayname}
                      sx={{ width: 36, height: 36 }}
                    >
                      {reply.displayname?.charAt(0) || reply.username?.charAt(0)}
                    </Avatar>
                    
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" component="div" fontWeight="bold">
                          {reply.displayname || reply.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(reply.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        in {reply.guildname}
                      </Typography>
                    </Box>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography 
                        variant="body2" 
                        color="text.primary" 
                        sx={{ 
                          pl: 1.5, 
                          borderLeft: '3px solid',
                          borderColor: 'text.disabled',
                          py: 0.5,
                          fontStyle: 'italic'
                        }}
                      >
                        "{reply.usermessage}"
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography 
                        variant="body2" 
                        color="text.primary" 
                        sx={{ 
                          pl: 1.5, 
                          borderLeft: '3px solid',
                          borderColor: 'primary.main',
                          py: 0.5
                        }}
                      >
                        {reply.botreply}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Grid>
    </Box>
  );
}

export default Dashboard;
