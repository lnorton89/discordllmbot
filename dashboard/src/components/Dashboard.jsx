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
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  ExpandMore as ExpandMoreIcon,
  Message as MessageIcon,
  People as PeopleIcon,
  Dns as DnsIcon,
  Token as TokenIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";

function Dashboard({ health }) {
  const [stats, setStats] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const formatUptime = (seconds) => {
    if (!seconds) return "N/A";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const StatusItem = ({ icon, label, value, color }) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2,
        flex: 1,
        minWidth: 0,
      }}
    >
      <Avatar
        variant="rounded"
        sx={{
          bgcolor: (theme) => alpha(theme.palette[color].main, 0.1),
          color: (theme) => theme.palette[color].main,
          width: 48,
          height: 48,
          flexShrink: 0,
        }}
      >
        {icon}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          fontWeight="medium"
          noWrap
        >
          {label}
        </Typography>
        <Typography variant="h6" fontWeight="bold" noWrap>
          {value}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={2}>
        {/* Left Column: Status Strip & Latest Activity */}
        <Grid>
          <Stack spacing={2}>
            {/* Status Strip */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: "flex",
                alignItems: "center",
                width: "100%",
              }}
            >
              <StatusItem
                icon={<MessageIcon />}
                label="Replies (24h)"
                value={stats?.stats24h?.total_replies || 0}
                color="primary"
              />
              <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
              <StatusItem
                icon={<DnsIcon />}
                label="Active Servers"
                value={stats?.stats24h?.active_servers || 0}
                color="secondary"
              />
              <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
              <StatusItem
                icon={<PeopleIcon />}
                label="Active Users"
                value={stats?.stats24h?.active_users || 0}
                color="success"
              />
              <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
              <StatusItem
                icon={<TokenIcon />}
                label="Tokens Used"
                value={stats?.stats24h?.total_tokens || 0}
                color="warning"
              />
            </Paper>

            {/* Latest Activity */}
            <Paper
              variant="outlined"
              sx={{ height: "100%", overflow: "hidden" }}
            >
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
              <Box sx={{ height: "calc(100vh - 300px)", overflowY: "auto" }}>
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
                                    "{reply.usermessage}"
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

        {/* 3. Right Column: Metrics & Health */}
        <Grid item>
          <Stack spacing={2}>
            {/* Activity Table */}
            <Paper variant="outlined">
              <Box
                sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  Activity (7 Days)
                </Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 300 }}>
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
                sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  Top Servers
                </Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 300 }}>
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
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{ maxWidth: 100 }}
                            >
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
            <Accordion variant="outlined" defaultExpanded={false}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {health?.status === "ok" ? (
                    <CheckCircleIcon color="success" fontSize="small" />
                  ) : (
                    <ErrorIcon color="error" fontSize="small" />
                  )}
                  <Typography variant="subtitle2">System Health</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
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
                        {Math.round(health?.cpu_usage || 0)}%
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
                        {Math.round(health?.memory_usage || 0)}%
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
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
