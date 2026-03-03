/**
 * Knowledge Ingestion Component
 * Handles document uploads and RSS feed management
 * @module pages/Memory/KnowledgeIngestion
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Stack,
  Alert,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  RssFeed as RssIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Description as DocIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { knowledgeApi, RssFeed, IngestedDocument } from '@services/api';

interface KnowledgeIngestionProps {
  guildId: string;
}

export function KnowledgeIngestion({ guildId }: KnowledgeIngestionProps) {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [docs, setDocs] = useState<IngestedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openRssDialog, setOpenRssDialog] = useState(false);
  const [newFeed, setNewRss] = useState({ name: '', url: '', intervalMinutes: 60 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [feedsRes, docsRes] = await Promise.all([
        knowledgeApi.getRssFeeds(guildId),
        knowledgeApi.getDocuments(guildId)
      ]);
      setFeeds(feedsRes.data);
      setDocs(docsRes.data);
    } catch (error) {
      console.error('Failed to load ingestion data', error);
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (guildId) {
      loadData();
    }
  }, [guildId, loadData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await knowledgeApi.uploadDocument(guildId, file);
      loadData(); // Refresh list
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setUploading(false);
    }
  };

  const handleAddRss = async () => {
    try {
      await knowledgeApi.createRssFeed(guildId, newFeed);
      setOpenRssDialog(false);
      setNewRss({ name: '', url: '', intervalMinutes: 60 });
      loadData();
    } catch (error) {
      console.error('Failed to add RSS', error);
    }
  };

  const toggleRss = async (feed: RssFeed) => {
    try {
      await knowledgeApi.updateRssFeed(guildId, feed.id, { enabled: !feed.enabled });
      loadData();
    } catch (error) {
      console.error('Failed to toggle RSS', error);
    }
  };

  const deleteRss = async (id: number) => {
    if (!window.confirm('Delete this RSS feed?')) return;
    try {
      await knowledgeApi.deleteRssFeed(guildId, id);
      loadData();
    } catch (error) {
      console.error('Failed to delete RSS', error);
    }
  };

  const deleteDoc = async (id: number) => {
    if (!window.confirm('Delete this document and all its associated knowledge from the graph?')) return;
    try {
      await knowledgeApi.deleteDocument(guildId, id);
      loadData();
    } catch (error) {
      console.error('Failed to delete document', error);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'completed': return <Chip size="small" icon={<SuccessIcon />} label="Ingested" color="success" variant="outlined" />;
      case 'processing': return <Chip size="small" icon={<CircularProgress size={14} />} label="Processing" color="info" variant="outlined" />;
      case 'error': return <Chip size="small" icon={<ErrorIcon />} label="Error" color="error" variant="outlined" />;
      default: return <Chip size="small" label="Pending" variant="outlined" />;
    }
  };

  if (loading) return <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 1, sm: 1 } }}>
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {/* Document Ingestion */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, height: '100%' }}>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              justifyContent="space-between" 
              alignItems={{ xs: 'stretch', sm: 'center' }} 
              spacing={{ xs: 1, sm: 0 }}
              sx={{ mb: 2 }}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                <DocIcon color="primary" /> Documents
              </Typography>
              <Button
                variant="contained"
                component="label"
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                disabled={uploading}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Upload File
                <input type="file" hidden onChange={handleFileUpload} accept=".pdf,.txt,.md" />
              </Button>
            </Stack>

            <Alert severity="info" sx={{ mb: 2, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Supported formats: PDF, Text, Markdown. Content is automatically chunked and indexed into the knowledge graph.
            </Alert>

            <List sx={{ maxHeight: { xs: 300, sm: 400 }, overflow: 'auto' }}>
              {docs.map((doc) => (
                <ListItem key={doc.id} divider sx={{ py: { xs: 1, sm: 1.5 } }}>
                  <ListItemText
                    primary={doc.filename}
                    secondary={new Date(doc.createdAt).toLocaleString()}
                    slotProps={{ 
                      primary: { 
                        variant: 'body2', 
                        fontWeight: 'medium',
                        sx: { fontSize: { xs: '0.85rem', sm: '0.9rem' } }
                      },
                      secondary: {
                        sx: { fontSize: { xs: '0.7rem', sm: '0.75rem' } }
                      }
                    }}
                    sx={{ pr: { xs: 1, sm: 2 } }}
                  />
                  <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    {getStatusChip(doc.status)}
                    <IconButton size="small" color="error" onClick={() => deleteDoc(doc.id)} title="Delete document">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItem>
              ))}
              {docs.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: { xs: 3, sm: 4 }, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                  No documents uploaded yet.
                </Typography>
              )}
            </List>
          </Paper>
        </Grid>

        {/* RSS Ingestion */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, height: '100%' }}>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              justifyContent="space-between" 
              alignItems={{ xs: 'stretch', sm: 'center' }}
              spacing={{ xs: 1, sm: 0 }} 
              sx={{ mb: 2 }}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                <RssIcon color="warning" /> RSS Feeds
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setOpenRssDialog(true)}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Add Feed
              </Button>
            </Stack>

            <List sx={{ maxHeight: { xs: 300, sm: 400 }, overflow: 'auto' }}>
              {feeds.map((feed) => (
                <ListItem key={feed.id} divider sx={{ py: { xs: 1, sm: 1.5 } }}>
                  <ListItemText
                    primary={feed.name}
                    secondary={`${feed.url} (${feed.intervalMinutes}m)`}
                    slotProps={{ 
                      primary: { 
                        variant: 'body2', 
                        fontWeight: 'medium',
                        sx: { fontSize: { xs: '0.85rem', sm: '0.9rem' } }
                      },
                      secondary: {
                        sx: { 
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                          wordBreak: 'break-word',
                        }
                      }
                    }}
                    sx={{ pr: { xs: 1, sm: 2 } }}
                  />
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    <FormControlLabel
                      control={<Switch size="small" checked={feed.enabled} onChange={() => toggleRss(feed)} />}
                      label={<Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Active</Typography>}
                      sx={{ mr: 0 }}
                    />
                    <IconButton size="small" color="error" onClick={() => deleteRss(feed.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </ListItem>
              ))}
              {feeds.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: { xs: 3, sm: 4 }, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                  No RSS feeds configured.
                </Typography>
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Add RSS Dialog */}
      <Dialog 
        open={openRssDialog} 
        onClose={() => setOpenRssDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add RSS Feed</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2 } }}>
            <TextField
              fullWidth
              label="Feed Name"
              value={newFeed.name}
              onChange={(e) => setNewRss({ ...newFeed, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="RSS URL"
              value={newFeed.url}
              onChange={(e) => setNewRss({ ...newFeed, url: e.target.value })}
            />
            <TextField
              fullWidth
              type="number"
              label="Update Interval (minutes)"
              value={newFeed.intervalMinutes}
              onChange={(e) => setNewRss({ ...newFeed, intervalMinutes: parseInt(e.target.value) })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
          <Button onClick={() => setOpenRssDialog(false)}>Cancel</Button>
          <Button onClick={handleAddRss} variant="contained" disabled={!newFeed.name || !newFeed.url}>Add Feed</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
