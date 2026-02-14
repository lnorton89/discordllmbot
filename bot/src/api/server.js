import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { logger } from '../../../shared/utils/logger.js';
import { loadConfig, reloadConfig, getServerConfig, updateServerConfig, clearServerConfigCache } from '../../../shared/config/configLoader.js';
import { loadGuildRelationships } from '../personality/relationships.js';
import { generateReply, getAvailableModels } from '../llm/index.js';
import { getLatestReplies, getAnalyticsData, loadRelationships, saveRelationships, deleteServerConfig, saveGlobalConfig } from '../../../shared/storage/persistence.js';
import os from 'os';

const LOG_FILE_PATH = path.join(process.cwd(), '..', 'logs', 'discordllmbot.log');

// Variables to track CPU usage over time
let prevCpuTimes = null;
let prevTimestamp = null;

export function startApi(client) {
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

        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = (usedMemory / totalMemory) * 100;

        // Calculate CPU usage by comparing with previous measurement
        const currentTimestamp = Date.now();
        const currentCpus = os.cpus();

        let currentTotalIdle = 0;
        let currentTotalTick = 0;

        for (let i = 0; i < currentCpus.length; i++) {
            const cpu = currentCpus[i];
            for (const type in cpu.times) {
                currentTotalTick += cpu.times[type];
            }
            currentTotalIdle += cpu.times.idle;
        }

        let cpuUsagePercent = 0;

        if (prevCpuTimes !== null && prevTimestamp !== null) {
            const elapsedMs = currentTimestamp - prevTimestamp;
            const idleDiff = currentTotalIdle - prevCpuTimes.idle;
            const totalDiff = currentTotalTick - prevCpuTimes.total;

            if (elapsedMs > 0 && totalDiff > 0) {
                const idlePercentage = (idleDiff / totalDiff) * 100;
                cpuUsagePercent = 100 - idlePercentage;

                // Ensure the value is within reasonable bounds
                cpuUsagePercent = Math.max(0, Math.min(100, cpuUsagePercent));
            }
        }

        // Store current values for next comparison
        prevCpuTimes = {
            idle: currentTotalIdle,
            total: currentTotalTick
        };
        prevTimestamp = currentTimestamp;

        res.json({
            status: 'ok',
            uptime: process.uptime(),
            cpu_usage: parseFloat(cpuUsagePercent.toFixed(2)),
            memory_usage: parseFloat(memoryUsagePercent.toFixed(2)),
            botStatus: client.isReady() ? 'ready' : 'not_ready'
        });
    });

    // Config endpoint
    app.get('/api/config', async (req, res) => {
        try {
            const config = await loadConfig();
            console.log('Loaded Global Config:', JSON.stringify(config, null, 2));
            res.json(config);
        } catch (err) {
            logger.error('Failed to load global config', err);
            res.status(500).json({ error: 'Failed to load config' });
        }
    });

    // Server-specific config endpoints
    app.get('/api/servers/:guildId/config', async (req, res) => {
        try {
            const { guildId } = req.params;
            const config = await getServerConfig(guildId);
            
            // Get guild name for logging
            const guild = client.guilds.cache.get(guildId);
            const guildName = guild ? guild.name : 'Unknown Guild';
            
            console.log('Loaded Server Config for guild', `${guildName} (${guildId}):`, JSON.stringify(config, null, 2));
            res.json(config);
        } catch (err) {
            const guild = client.guilds.cache.get(req.params.guildId);
            const guildName = guild ? guild.name : 'Unknown Guild';
            logger.error(`Failed to get config for guild ${guildName} (${req.params.guildId})`, err);
            res.status(500).json({ error: 'Failed to get server config' });
        }
    });

    app.post('/api/servers/:guildId/config', async (req, res) => {
        try {
            const { guildId } = req.params;
            const newConfig = req.body;
            if (!newConfig || typeof newConfig !== 'object') {
                return res.status(400).json({ error: 'Invalid config format' });
            }
            
            // Get guild name for logging
            const guild = client.guilds.cache.get(guildId);
            const guildName = guild ? guild.name : 'Unknown Guild';
            
            await updateServerConfig(guildId, newConfig);
            console.log('Updated Server Config for guild', `${guildName} (${guildId}):`, JSON.stringify(newConfig, null, 2));
            res.json({ message: 'Server config updated successfully' });
        } catch (err) {
            const guild = client.guilds.cache.get(req.params.guildId);
            const guildName = guild ? guild.name : 'Unknown Guild';
            logger.error(`Failed to update config for guild ${guildName} (${req.params.guildId})`, err);
            res.status(500).json({ error: 'Failed to update server config' });
        }
    });

    app.delete('/api/servers/:guildId/config', async (req, res) => {
        try {
            const { guildId } = req.params;
            
            // Get guild name for logging
            const guild = client.guilds.cache.get(guildId);
            const guildName = guild ? guild.name : 'Unknown Guild';
            
            await deleteServerConfig(guildId);
            clearServerConfigCache(guildId);
            console.log('Server config reset to default for guild', `${guildName} (${guildId})`);
            res.json({ message: 'Server config reset to default' });
        } catch (err) {
            const guild = client.guilds.cache.get(req.params.guildId);
            const guildName = guild ? guild.name : 'Unknown Guild';
            logger.error(`Failed to reset config for guild ${guildName} (${req.params.guildId})`, err);
            res.status(500).json({ error: 'Failed to reset server config' });
        }
    });

    app.post('/api/config', async (req, res) => {
        try {
            const newConfig = req.body;
            // Basic validation: ensure it's an object
            if (!newConfig || typeof newConfig !== 'object') {
                return res.status(400).json({ error: 'Invalid config format' });
            }

            // Save to database instead of JSON file
            await saveGlobalConfig(newConfig);
            logger.info('Global config updated via API and saved to database');

            // Reload config in memory
            try {
                await reloadConfig();
                logger.info('Global configuration reloaded from database.');
                console.log('Updated Global Config:', JSON.stringify(newConfig, null, 2));
            } catch (reloadErr) {
                logger.error('Failed to reload global config in memory', reloadErr);
            }

            res.json({ message: 'Global config updated successfully' });
        } catch (err) {
            logger.error('Failed to update global config', err);
            res.status(500).json({ error: 'Failed to update global config' });
        }
    });

    // Relationships endpoints
    app.get('/api/guilds', async (req, res) => {
        try {
            // Use client cache directly
            const guilds = client.guilds.cache.map(guild => ({ id: guild.id, name: guild.name }));
            res.json(guilds);
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

            // Reload relationships in bot memory
            try {
                await loadGuildRelationships(guildId);
                logger.info(`Reloaded relationships for guild ${guildId} via API.`);
            } catch (reloadErr) {
                logger.error(`Failed to reload relationships for guild ${guildId}`, reloadErr);
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

    // Servers endpoints
    app.get('/api/servers', async (req, res) => {
        try {
            const servers = client.guilds.cache.map(guild => ({
                id: guild.id,
                name: guild.name,
                joinedAt: guild.joinedAt,
                iconURL: guild.iconURL({ forceStatic: true, size: 64 }),
                memberCount: guild.memberCount,
                ownerId: guild.ownerId
            }));
            res.json(servers);
        } catch (err) {
            logger.error('Failed to load servers', err);
            res.status(500).json({ error: 'Failed to load servers' });
        }
    });

    app.delete('/api/servers/:serverId', async (req, res) => {
        try {
            const { serverId } = req.params;
            const guild = client.guilds.cache.get(serverId);
            if (guild) {
                await guild.leave();
                res.json({ message: 'Server left successfully' });
            } else {
                res.status(404).json({ error: 'Server not found' });
            }
        } catch (err) {
            logger.error('Failed to leave server', err);
            res.status(500).json({ error: 'Failed to leave server' });
        }
    });

    // Endpoint to get bot invite URL
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

    app.get('/api/models', async (req, res) => {
        try {
            const config = await loadConfig();
            const requestedProvider = req.query.provider || config.api?.provider || 'gemini';

            if (requestedProvider === 'gemini') {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
                }
            }

            const models = await getAvailableModels(requestedProvider);
            res.json(models);
        } catch (err) {
            logger.error(`Failed to fetch models:`, err);
            res.status(500).json({ error: `Failed to fetch models from ${req.query.provider || 'Gemini'} API` });
        }
    });

    // Endpoint to get channels for a specific guild
    app.get('/api/guilds/:guildId/channels', async (req, res) => {
        try {
            const { guildId } = req.params;
            const guild = client.guilds.cache.get(guildId);

            if (!guild) {
                return res.status(404).json({ error: 'Guild not found' });
            }

            const channels = await guild.channels.fetch();
            const channelList = channels
                .filter(channel => channel.type === 0) // Filter for text channels only
                .map(channel => ({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    parentId: channel.parentId,
                    position: channel.position
                }));

            res.json(channelList);
        } catch (err) {
            logger.error('Failed to fetch channels', err);
            res.status(500).json({ error: 'Failed to fetch channels' });
        }
    });

    // Endpoint to get latest bot replies
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

    // Endpoint to get analytics data
    app.get('/api/analytics', async (req, res) => {
        try {
            const data = await getAnalyticsData();
            res.json(data);
        } catch (err) {
            logger.error('Failed to fetch analytics', err);
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    });

    // Endpoint for playground chat
    app.post('/api/chat', async (req, res) => {
        try {
            const { content } = req.body;
            const reply = await generateReply(content);
            res.json(reply);
        } catch (err) {
            logger.error('Failed to generate reply', err);
            res.status(500).json({ error: 'Failed to generate reply' });
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

    httpServer.listen(PORT, () => {
        logger.info(`API server running on port ${PORT}`);
    });

    return { app, io };
}
