import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { logger } from '../shared/utils/logger.js';
import { loadConfig } from '../shared/config/configLoader.js';
import { connect, setupSchema } from '../shared/storage/database.js';
import { loadRelationships, saveRelationships, getLatestReplies, getAnalyticsData } from '../shared/storage/persistence.js';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In Docker, process.cwd() is /usr/src/app/api, but shared is at /usr/src/app/shared
// So we need to go up one level to access shared
const BOT_CONFIG_PATH = path.join(process.cwd(), '..', 'shared', 'config', 'bot.json');
const LOG_FILE_PATH = path.join(process.cwd(), '..', 'logs', 'discordllmbot.log');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for now (dev)
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.API_PORT || 3000;

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Config endpoint
app.get('/api/config', (req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (err) {
    logger.error('Failed to load config', err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    // Basic validation: ensure it's an object
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ error: 'Invalid config format' });
    }

    fs.writeFileSync(BOT_CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
    logger.info('Config updated via API');
    res.json({ message: 'Config updated successfully' });
  } catch (err) {
    logger.error('Failed to update config', err);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Relationships endpoints
app.get('/api/guilds', async (req, res) => {
  try {
    const db = await connect();
    const result = await db.query('SELECT guildId, guildName FROM guilds');
    res.json(result.rows.map(r => ({ id: r.guildid, name: r.guildname })));
  } catch (err) {
    logger.error('Failed to load guilds', err);
    res.status(500).json({ error: 'Failed to load guilds' });
  }
});

app.get('/api/guilds/:guildId/relationships', async (req, res) => {
  try {
    const { guildId } = req.params;
    const relationships = await loadRelationships(guildId);
    res.json(relationships);
  } catch (err) {
    logger.error('Failed to load relationships', err);
    res.status(500).json({ error: 'Failed to load relationships' });
  }
});

app.post('/api/guilds/:guildId/relationships/:userId', async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const newRel = req.body;

    // Load current relationships for the guild
    const currentRels = await loadRelationships(guildId);

    // Update the specific user's relationship
    currentRels[userId] = newRel;

    // Save back to DB
    await saveRelationships(guildId, currentRels);

    // Notify bot to reload
    try {
      await axios.post('http://bot:3001/reload', { guildId });
      logger.info(`Sent reload request to bot for guild ${guildId}`);
    } catch (reloadErr) {
      logger.error(`Failed to send reload request to bot for guild ${guildId}`, reloadErr);
    }

    res.json({ message: 'Relationship updated successfully' });
  } catch (err) {
    logger.error('Failed to update relationship', err);
    res.status(500).json({ error: 'Failed to update relationship' });
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  logger.info('Dashboard client connected');
  
  // Send last 50 lines of logs on connection
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const logs = fs.readFileSync(LOG_FILE_PATH, 'utf-8').split('\n').slice(-50);
      socket.emit('logs:init', logs);
    }
  } catch (err) {
    logger.error('Failed to read log file for init', err);
  }

  socket.on('disconnect', () => {
    logger.info('Dashboard client disconnected');
  });
});

// NEW: Servers endpoints
app.get('/api/servers', async (req, res) => {
  try {
    let servers = [];
    
    try {
      // Try to fetch guild information from the bot first
      const botResponse = await axios.get('http://bot:3001/guilds');
      const botGuilds = botResponse.data;
      
      servers = botGuilds.map(guild => ({
        id: guild.id,
        name: guild.name,
        joinedAt: guild.joinedAt,
        iconURL: guild.iconURL,
        memberCount: guild.memberCount
      }));
    } catch (botErr) {
      logger.warn('Could not fetch guilds from bot, falling back to database', botErr);
      
      // Fallback to database if bot is not available
      const db = await connect();
      const dbResult = await db.query('SELECT guildId, guildName FROM guilds');
      
      servers = dbResult.rows.map(row => ({
        id: row.guildid,
        name: row.guildname,
        joinedAt: null, // Join date not available from database
        iconURL: null,
        memberCount: null
      }));
    }
    
    res.json(servers);
  } catch (err) {
    logger.error('Failed to load servers', err);
    res.status(500).json({ error: 'Failed to load servers' });
  }
});

app.delete('/api/servers/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    // Make a request to the bot to leave the server
    await axios.delete(`http://bot:3001/guilds/${serverId}`);
    
    res.json({ message: 'Server left successfully' });
  } catch (err) {
    logger.error('Failed to leave server', err);
    res.status(500).json({ error: 'Failed to leave server' });
  }
});

// NEW: Endpoint to get bot invite URL
app.get('/api/bot-info', async (req, res) => {
  try {
    const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=274878229568&scope=bot%20applications.commands`;
    
    res.json({ 
      inviteUrl: botInviteUrl,
      clientId: process.env.DISCORD_CLIENT_ID
    });
  } catch (err) {
    logger.error('Failed to get bot info', err);
    res.status(500).json({ error: 'Failed to get bot info' });
  }
});

// NEW: Endpoint to get available Gemini models
app.get('/api/models', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    // Filter for models that support content generation
    const models = response.data.models
      .filter(m => m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', '')); // Remove 'models/' prefix for cleaner display

    res.json(models);
  } catch (err) {
    logger.error('Failed to fetch Gemini models', err);
    // Fallback to a default list if API call fails
    res.json(['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']);
  }
});

// NEW: Endpoint to get latest bot replies
app.get('/api/replies', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const replies = await getLatestReplies(limit);
    res.json(replies);
  } catch (err) {
    logger.error('Failed to fetch latest replies', err);
    res.status(500).json({ error: 'Failed to fetch latest replies' });
  }
});

// NEW: Endpoint to get analytics data
app.get('/api/analytics', async (req, res) => {
  try {
    const data = await getAnalyticsData();
    res.json(data);
  } catch (err) {
    logger.error('Failed to fetch analytics', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Watch log file for changes
if (fs.existsSync(LOG_FILE_PATH)) {
  let fileSize = fs.statSync(LOG_FILE_PATH).size;
  fs.watch(LOG_FILE_PATH, (event) => {
    if (event === 'change') {
      const stats = fs.statSync(LOG_FILE_PATH);
      if (stats.size > fileSize) {
        const stream = fs.createReadStream(LOG_FILE_PATH, {
          start: fileSize,
          end: stats.size
        });
        stream.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(l => l.trim());
          lines.forEach(line => io.emit('log', line));
        });
        fileSize = stats.size;
      } else if (stats.size < fileSize) {
        // File was truncated
        fileSize = stats.size;
      }
    }
  });
}

// Start server
async function start() {
  try {
    await connect(); // Connect to DB
    await setupSchema(); // Ensure schema is set up
    logger.info('API connected to database');

    httpServer.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start API server', err);
    process.exit(1);
  }
}

start();
