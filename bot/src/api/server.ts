/**
 * API Server Module
 *
 * Express + Socket.io API server for the Discord bot dashboard.
 * Provides REST endpoints for configuration, relationships, analytics, and database management.
 * Also handles real-time log streaming via Socket.io.
 *
 * @module bot/src/api/server
 */

import 'dotenv/config';

import fs from 'fs';
import os from 'os';
import path from 'path';

import { Client } from 'discord.js';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
    createAnalyticsRoutes,
    createConfigRoutes,
    createDatabaseRoutes,
    createGuildsRoutes,
    createHypergraphRoutes,
    createKnowledgeRoutes,
    createLlmRoutes,
} from '@api/routes/index.js';
import { logger } from '@shared/utils/logger.js';
import { getSqlLogEmitter } from '@shared/storage/persistence.js';

const LOG_FILE_PATH = path.join(process.cwd(), '..', 'logs', 'discordllmbot.log');

/**
 * Interface for CPU times used in CPU usage calculation.
 */
interface CpuTimes {
    idle: number;
    total: number;
}

let prevCpuTimes: CpuTimes | null = null;
let prevTimestamp: number | null = null;
let isRestarting = false;
let io: SocketIOServer;

/**
 * Starts the Express API server and Socket.io for the dashboard.
 * Sets up all REST endpoints and real-time log streaming.
 *
 * @param client - The Discord.js client instance
 * @returns Object containing the Express app and Socket.io server
 */
export function startApi(client: Client): { app: Express; io: SocketIOServer } {
    const app: Express = express();
    const httpServer: HttpServer = createServer(app);
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    const PORT = process.env.API_PORT || 3000;

    app.use(cors());
    app.use(express.json());

    // Register route modules
    app.use('/api', createConfigRoutes({ client, io, isRestarting, setIsRestarting: (v) => { isRestarting = v; } }));
    app.use('/api', createAnalyticsRoutes());
    app.use('/api', createDatabaseRoutes());
    app.use('/api', createGuildsRoutes({ client }));
    app.use('/api', createLlmRoutes());
    app.use('/api/hypergraph', createHypergraphRoutes());
    app.use('/api/knowledge', createKnowledgeRoutes());

    // Health endpoint
    app.get('/api/health', (_req: Request, res: Response) => {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = (usedMemory / totalMemory) * 100;

        const currentTimestamp = Date.now();
        const currentCpus = os.cpus();

        let currentTotalIdle = 0;
        let currentTotalTick = 0;

        for (let i = 0; i < currentCpus.length; i++) {
            const cpu = currentCpus[i];
            for (const type in cpu.times) {
                currentTotalTick += cpu.times[type as keyof typeof cpu.times];
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
                cpuUsagePercent = Math.max(0, Math.min(100, cpuUsagePercent));
            }
        }

        prevCpuTimes = { idle: currentTotalIdle, total: currentTotalTick };
        prevTimestamp = currentTimestamp;

        res.json({
            status: 'ok',
            uptime: process.uptime(),
            cpu_usage: parseFloat(cpuUsagePercent.toFixed(2)),
            memory_usage: parseFloat(memoryUsagePercent.toFixed(2)),
            botStatus: client.isReady() ? 'ready' : 'not_ready',
        });
    });

    // Socket.io connection handler for real-time logs
    io.on('connection', (socket: Socket) => {
        logger.info('Dashboard client connected');

        socket.emit('bot:status', { isRestarting });

        // Send initial logs
        try {
            if (fs.existsSync(LOG_FILE_PATH)) {
                const logs = fs
                    .readFileSync(LOG_FILE_PATH, 'utf-8')
                    .split('\n')
                    .slice(-50)
                    .map((line) => line.replace(/[\n\r]/g, '\\n'))
                    .filter((l) => l.trim());
                socket.emit('logs:init', logs);
            }
        } catch (err) {
            logger.error('Failed to read log file for init', err);
        }

        socket.on('disconnect', () => {
            logger.info('Dashboard client disconnected');
        });
    });

    // SQL log streaming
    const sqlLogEmitter = getSqlLogEmitter();
    sqlLogEmitter.on('query', (logLine: string, data: { query: string; params?: unknown[]; duration: number; error?: string }) => {
        const timestamp = new Date().toISOString();
        const jsonStr = JSON.stringify(data).replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        const fullLogLine = `[${timestamp}] [SQL] ${logLine} ${jsonStr}`;
        io.emit('log', fullLogLine);
        io.emit('db:log', fullLogLine);
    });

    // General log streaming
    logger.onLog((logEntry: { timestamp: string; level: string; message: string; formatted: string }) => {
        if (io) {
            io.emit('log', logEntry.formatted);
        }
    });

    httpServer.listen(PORT, () => {
        logger.info(`API server listening on port ${PORT}`);
    });

    return { app, io };
}
