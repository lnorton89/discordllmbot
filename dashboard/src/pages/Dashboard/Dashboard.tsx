/**
 * Dashboard page showing analytics, activity, and system health.
 * @module pages/Dashboard/Dashboard
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
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
  Theme,
  Button,
} from '@mui/material';
import {
  Message as MessageIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  EmojiEvents as EmojiEventsIcon,
  Analytics as AnalyticsIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import type { SxProps } from '@mui/material';

import { useAnalytics } from '@hooks';
import { formatTime, limitArray, formatUptime } from '@utils';
import type { AnalyticsResponse, Reply, HealthResponse } from '@types';

/** Props for the StatusItem component. */
interface StatusItemProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

/** Status item component displaying an icon, label, and value. */
const StatusItem = ({ icon, label, value, color }: StatusItemProps) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: { xs: 0.5, sm: 1 },
      p: 1,
      px: 1,
      flex: 1,
      minWidth: 0,
    } as SxProps<Theme>}
  >
    <Avatar
      variant="rounded"
      sx={{
        bgcolor: (theme: Theme) => alpha(theme.palette[color].main, 0.1),
        color: (theme: Theme) => theme.palette[color].main,
        width: { xs: 24, sm: 28, md: 32 },
        height: { xs: 24, sm: 28, md: 32 },
        flexShrink: 0,
      } as SxProps<Theme>}
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
            xs: '0.65rem',
            sm: '0.75rem',
          },
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } as SxProps<Theme>}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight="bold"
        noWrap
        sx={{
          fontSize: {
            xs: '0.8rem',
            sm: '1rem',
          },
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } as SxProps<Theme>}
      >
        {value}
      </Typography>
    </Box>
  </Box>
);

/** Props for the Dashboard component. */
interface DashboardProps {
  health?: HealthResponse | null;
}

/** Main dashboard page displaying analytics, activity feed, and system health. */
function Dashboard({ health }: DashboardProps) {
  const { stats, replies, overview, volume, loading } = useAnalytics();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  
  // Limit replies to 5 on mobile
  const displayedReplies = isMobile ? limitArray(replies as Reply[], 5) : replies as Reply[];

  const renderLoadingSkeleton = () =>
    [...Array(isMobile ? 5 : 10)].map((_, i) => (
      <Box key={i} sx={{ p: 2 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </Box>
    ));

  const renderRepliesList = () =>
    displayedReplies.map((reply) => (
      <React.Fragment key={reply.id}>
        <ListItem alignItems="flex-start" sx={{ py: 1 }}>
          <ListItemAvatar sx={{ minWidth: 40, mt: 0.5 }}>
            <Avatar
              alt={reply.username}
              src={reply.avatarurl}
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.8rem',
              }}
            >
              {reply.username?.charAt(0)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" fontWeight="bold" component="span">
                  {reply.displayname || reply.username}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(reply.timestamp)}
                </Typography>
              </Box>
            }
            slotProps={{
                secondary: { component: 'div' }
              }}
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
                    fontStyle: 'italic',
                    fontSize: '0.8rem',
                    color: 'text.secondary',
                  }}
                >
                  &quot;{reply.usermessage}&quot;
                </Typography>
                <Typography
                  variant="body2"
                  color="text.primary"
                  sx={{ mt: 0.5, fontSize: '0.85rem' }}
                >
                  {reply.botreply}
                </Typography>
              </Box>
            }
          />
        </ListItem>
        <Divider component="li" />
      </React.Fragment>
    ));

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">
          Dashboard
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AnalyticsIcon />}
          onClick={() => navigate('/analytics')}
        >
          Detailed Analytics
        </Button>
      </Box>
      <Grid container spacing={2}>
        {/* Left Column: Status Strip & Latest Activity */}
        <Grid size={{ xs: 12, md: 9 }}>
          <Stack spacing={2}>
            {/* Status Strip */}
            <Paper
              variant="outlined"
              sx={{
                p: 1,
                px: 2,
              }}
            >
              <Grid container spacing={1}>
                <Grid size={{ xs: 6, sm: 2.4 }}>
                  <StatusItem
                    icon={<MessageIcon />}
                    label="Messages"
                    value={overview?.stats?.total_messages || (stats as AnalyticsResponse)?.stats24h?.total_replies || 0}
                    color="primary"
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2.4 }}>
                  <StatusItem
                    icon={<CheckCircleIcon />}
                    label="Replies"
                    value={overview?.stats?.total_replies || (stats as AnalyticsResponse)?.stats24h?.total_replies || 0}
                    color="success"
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2.4 }}>
                  <StatusItem
                    icon={<TrendingUpIcon />}
                    label="Reply Rate"
                    value={`${overview?.replyRate || 0}%`}
                    color="info"
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2.4 }}>
                  <StatusItem
                    icon={<PeopleIcon />}
                    label="Active Users"
                    value={overview?.stats?.active_users || (stats as AnalyticsResponse)?.stats24h?.active_users || 0}
                    color="secondary"
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2.4 }}>
                  <StatusItem
                    icon={<ErrorIcon />}
                    label="Error Rate"
                    value={`${overview?.errorRate || 0}%`}
                    color={overview?.errorRate && overview.errorRate > 5 ? 'error' : 'success'}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Latest Activity */}
            <Paper variant="outlined">
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  Latest Activity
                </Typography>
              </Box>
              <Box sx={{}}>
                <List dense sx={{ p: 0 }}>
                  {loading && !replies.length ? renderLoadingSkeleton() : renderRepliesList()}
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
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
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
                      <TableCell align="right" sx={{ py: 1, px: 2 }}>Messages</TableCell>
                      <TableCell align="right" sx={{ py: 1, px: 2 }}>Replies</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {volume?.daily && volume.daily.length > 0 ? (
                      [...volume.daily].reverse().map((day) => (
                        <TableRow key={day.date}>
                          <TableCell sx={{ py: 1, px: 2, borderBottom: 'none' }}>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(day.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1, px: 2, borderBottom: 'none' }}>
                            <Typography variant="caption" fontWeight="bold">
                              {day.messages}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1, px: 2, borderBottom: 'none' }}>
                            <Typography variant="caption" fontWeight="bold" color="success.main">
                              {day.replies_sent}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell align="center" sx={{ py: 2, gridColumn: '1 / -1' }} colSpan={3}>
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
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
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
                    {(stats as AnalyticsResponse)?.topServers?.slice(0, 5).map((server) => (
                      <TableRow key={server.guildname}>
                        <TableCell sx={{ py: 1, px: 2, borderBottom: 'none' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Avatar
                              src={server.icon_url}
                              sx={{ width: 20, height: 20, fontSize: '0.7rem' }}
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
                          sx={{ py: 1, px: 2, borderBottom: 'none' }}
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
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {health?.status === 'ok' ? (
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
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
                        display: 'flex',
                        justifyContent: 'space-between',
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
                        display: 'flex',
                        justifyContent: 'space-between',
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
