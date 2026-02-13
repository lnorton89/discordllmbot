import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  LinearProgress,
  alpha,
} from "@mui/material";
import {
  Message as MessageIcon,
  People as PeopleIcon,
  Dns as DnsIcon,
  Token as TokenIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  EmojiEvents as EmojiEventsIcon,
} from "@mui/icons-material";

const StatusItem = ({ icon, label, value, color }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: { xs: 0.5, sm: 1 }, // Smaller gap on small screens
      p: 1, // Reduced padding on smaller screens
      px: 1, // Reduced horizontal padding on small screens
      flex: 1,
      minWidth: 0, // Allows the box to shrink below its content's natural width
    }}
  >
    <Avatar
      variant="rounded"
      sx={{
        bgcolor: (theme) => alpha(theme.palette[color].main, 0.1),
        color: (theme) => theme.palette[color].main,
        width: { xs: 24, sm: 28, md: 32 }, // Even smaller avatar on small and medium screens
        height: { xs: 24, sm: 28, md: 32 },
        flexShrink: 0,
      }}
    >
      {icon}
    </Avatar>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        fontWeight="medium"
        noWrap
        sx={{
          fontSize: {
            xs: "0.65rem", // Smaller font size for extra small screens
            sm: "0.75rem", // Default size for small and above
          },
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight="bold"
        noWrap
        sx={{
          fontSize: {
            xs: "0.8rem", // Smaller font size for extra small screens
            sm: "1rem", // Default size for small and above
          },
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
    </Box>
  </Box>
);

function Dashboard({ health }) {
  const [stats, setStats] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [analyticsRes, repliesRes] = await Promise.all([
        axios.get("/api/analytics"),
        axios.get("/api/replies?limit=50"),
      ]);
      setStats(analyticsRes.data);
      setReplies(repliesRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return "N/A";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        {/* Left Column: Status Strip & Latest Activity */}
        <Grid size={{ xs: 12, md: 9 }}>
          <Stack spacing={2}>
            {/* Status Strip */}
            <Paper
              variant="outlined"
              sx={{
                p: 1, // Reduced padding on smaller screens
                px: 2, // Keep horizontal padding consistent
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: { xs: 1, sm: 0 },
              }}
            >
              <StatusItem
                icon={<MessageIcon />}
                label="Replies (24h)"
                value={stats?.stats24h?.total_replies || 0}
                color="primary"
              />
              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 2, display: { xs: "none", sm: "block" } }}
              />
              <StatusItem
                icon={<DnsIcon />}
                label="Active Servers"
                value={stats?.stats24h?.active_servers || 0}
                color="secondary"
              />
              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 2, display: { xs: "none", sm: "block" } }}
              />
              <StatusItem
                icon={<PeopleIcon />}
                label="Active Users"
                value={stats?.stats24h?.active_users || 0}
                color="success"
              />
              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 2, display: { xs: "none", sm: "block" } }}
              />
              <StatusItem
                icon={<TokenIcon />}
                label="Tokens Used"
                value={stats?.stats24h?.total_tokens || 0}
                color="warning"
              />
            </Paper>

            {/* Latest Activity */}
            <Paper variant="outlined">
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  Latest Activity
                </Typography>
              </Box>
              <Box sx={{}}>
                <List dense sx={{ p: 0 }}>
                  {loading && !replies.length
                    ? [...Array(10)].map((_, i) => (
                        <Box key={i} sx={{ p: 2 }}>
                          <Skeleton variant="text" width="60%" />
                          <Skeleton variant="text" width="40%" />
                        </Box>
                      ))
                    : replies.map((reply) => (
                        <React.Fragment key={reply.id}>
                          <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                            <ListItemAvatar sx={{ minWidth: 40, mt: 0.5 }}>
                              <Avatar
                                alt={reply.username}
                                src={reply.avatarurl}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  fontSize: "0.8rem",
                                }}
                              >
                                {reply.username?.charAt(0)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    fontWeight="bold"
                                    component="span"
                                  >
                                    {reply.displayname || reply.username}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {new Date(
                                      reply.timestamp,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </Typography>
                                </Box>
                              }
                              secondaryTypographyProps={{ component: "div" }}
                              secondary={
                                <Box component="div" sx={{ mt: 0.5 }}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                  >
                                    in {reply.guildname}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.primary"
                                    sx={{
                                      mt: 0.5,
                                      fontStyle: "italic",
                                      fontSize: "0.8rem",
                                      color: "text.secondary",
                                    }}
                                  >
                                    &quot;{reply.usermessage}&quot;
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.primary"
                                    sx={{ mt: 0.5, fontSize: "0.85rem" }}
                                  >
                                    {reply.botreply}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                          <Divider component="li" />
                        </React.Fragment>
                      ))}
                </List>
              </Box>
            </Paper>
          </Stack>
        </Grid>

        {/* Right Column: Metrics & Health */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Stack spacing={2}>
            {/* Activity Table */}
            <Paper variant="outlined">
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <TrendingUpIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight="bold">
                  Activity (7 Days)
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 1, px: 2 }}>Date</TableCell>
                      <TableCell align="right" sx={{ py: 1, px: 2 }}>
                        Replies
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats?.volume &&
                      [...stats.volume].reverse().map((day) => (
                        <TableRow key={day.date}>
                          <TableCell
                            sx={{ py: 1, px: 2, borderBottom: "none" }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {new Date(day.date).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                            </Typography>
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ py: 1, px: 2, borderBottom: "none" }}
                          >
                            <Typography variant="caption" fontWeight="bold">
                              {day.count}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    {(!stats?.volume || stats.volume.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            No activity data
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Top Servers */}
            <Paper variant="outlined">
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <EmojiEventsIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight="bold">
                  Top Servers
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {stats?.topServers?.slice(0, 5).map((server) => (
                      <TableRow key={server.guildname}>
                        <TableCell sx={{ py: 1, px: 2, borderBottom: "none" }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Avatar
                              src={server.icon_url}
                              sx={{ width: 20, height: 20, fontSize: "0.7rem" }}
                            >
                              {server.guildname.charAt(0)}
                            </Avatar>
                            <Typography variant="caption" noWrap>
                              {server.guildname}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ py: 1, px: 2, borderBottom: "none" }}
                        >
                          <Typography variant="caption" fontWeight="bold">
                            {server.reply_count}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* System Health */}
            <Paper variant="outlined">
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                {health?.status === "ok" ? (
                  <CheckCircleIcon fontSize="small" color="success" />
                ) : (
                  <ErrorIcon fontSize="small" color="error" />
                )}
                <Typography variant="subtitle2" fontWeight="bold">
                  System Health
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Uptime
                    </Typography>
                    <Typography variant="caption" fontWeight="medium">
                      {formatUptime(health?.uptime)}
                    </Typography>
                  </Box>
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        CPU
                      </Typography>
                      <Typography variant="caption">
                        {health?.cpu_usage !== undefined ? `${Math.round(health.cpu_usage)}%` : 'N/A'}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={health?.cpu_usage || 0}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Memory
                      </Typography>
                      <Typography variant="caption">
                        {health?.memory_usage !== undefined ? `${Math.round(health.memory_usage)}%` : 'N/A'}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={health?.memory_usage || 0}
                      color="secondary"
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                </Stack>
              </Box>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
