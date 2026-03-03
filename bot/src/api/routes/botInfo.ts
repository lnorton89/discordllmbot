/**
 * Bot Info Routes
 *
 * Provides bot information (client ID, invite URL, etc.)
 *
 * @module bot/src/api/routes/botInfo
 */

import { Router, Request, Response } from 'express';
import { Client } from 'discord.js';
import { URLS } from '@shared/constants';

/**
 * Bot info response type
 */
export interface BotInfoResponse {
    clientId: string;
    inviteUrl: string;
    username: string | null;
    discriminator: string | null;
}

/**
 * Create bot info routes
 * @param client - Discord client instance
 * @returns Express router
 */
export function createBotInfoRoutes(client: Client): Router {
    const router = Router();

    /**
     * GET /api/bot-info
     * Returns bot information including client ID and invite URL
     */
    router.get('/bot-info', (_req: Request, res: Response<BotInfoResponse>) => {
        const clientId = client.user?.id || client.application?.id || '';
        const username = client.user?.username || null;
        const discriminator = client.user?.discriminator || null;

        // Generate invite URL with basic permissions
        // You can customize these permissions as needed
        const permissions = '0'; // No permissions by default
        const scopes = 'bot%20applications.commands';
        const inviteUrl = `${URLS.DISCORD.OAUTH}?client_id=${clientId}&permissions=${permissions}&scopes=${scopes}`;

        res.json({
            clientId,
            inviteUrl,
            username,
            discriminator,
        });
    });

    return router;
}
