/**
 * DiscordLLMBot - Main Entry Point
 *
 * A lightweight, persona-driven Discord bot using Google's Gemini API or Ollama.
 * This module initializes the Discord client, database, and API server.
 *
 * @module bot/src/index
 */

import 'dotenv/config';

import { Client, GatewayIntentBits, Partials } from 'discord.js';

import { logger, initializeLogger } from '@shared/utils/logger.js';
import { pruneOldMessages, resetPoolWrapper } from '@shared/storage/persistence.js';
import { validateEnvironment } from '@shared/config/validation.js';

import { startApi } from '@api/server.js';
import { handleClientReady, handleGuildCreate, handleGuildMemberAdd, handleMessageCreate } from '@events/index.js';
import { decayManager } from '@memory/decay.js';

const startTime = Date.now();

/**
 * Initializes the logger with default settings before full config is loaded.
 */
initializeLogger(undefined);
logger.info('Startup modules loaded', { elapsedMs: Date.now() - startTime });

/**
 * Main async function to start the Discord bot.
 * Sets up Discord client, database connection, event handlers, and API server.
 * Handles graceful shutdown on SIGINT/SIGTERM signals.
 * 
 * @async
 * @function startBot
 * @returns {Promise<void>} Resolves when bot starts successfully
 * @throws {Error} Exits with code 1 if startup fails
 */
async function startBot(): Promise<void> {
    let cleanupInterval: NodeJS.Timeout | null = null;

    try {
        const { setSqlLoggingEnabled } = await import('@shared/config/configLoader.js');
        const { loadConfig, getGlobalMemoryConfig } = await import('@shared/config/configLoader.js');
        const fullConfig = await loadConfig();

        initializeLogger(fullConfig.logger?.maxLogLines);

        setSqlLoggingEnabled(fullConfig.logger?.logSql ?? false);
        resetPoolWrapper();
        const botConfig = {
            name: fullConfig.botPersona?.username,
            description: fullConfig.botPersona?.description,
            persona: ''
        };

        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ],
            partials: [Partials.Channel]
        });

        validateEnvironment();

        client.once('clientReady', async () => {
            handleClientReady(client, botConfig);

            // Set client for decay manager
            decayManager.setClient(client);

            // Start memory decay manager (runs every hour)
            decayManager.start(60);

            // Start RSS ingestion checker (runs every 15 minutes)
            const { startRssInformer } = await import('@core/knowledgeIngestion.js');
            
            // Run immediately on startup
            for (const [guildId] of client.guilds.cache) {
                startRssInformer(guildId).catch(e => logger.error(`Initial RSS informer failed for ${guildId}`, e));
            }

            setInterval(async () => {
                for (const [guildId] of client.guilds.cache) {
                    await startRssInformer(guildId).catch(e => logger.error(`RSS informer failed for ${guildId}`, e));
                }
            }, 1000 * 60 * 15);

            cleanupInterval = setInterval(async () => {
                try {
                    const memoryConfig = await getGlobalMemoryConfig();
                    await pruneOldMessages(memoryConfig.maxMessageAgeDays);
                } catch (err) {
                    logger.error('Error during message pruning', err);
                }
            }, 1000 * 60 * 60 * 24);
        });
        client.on('messageCreate', (message) => handleMessageCreate(message, client));
        client.on('guildCreate', handleGuildCreate);
        client.on('guildMemberAdd', handleGuildMemberAdd);

        startApi(client);

        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            try {
                decayManager.stop();
                if (cleanupInterval) {
                    clearInterval(cleanupInterval);
                }
                await client.destroy();
                logger.info('✓ Discord client disconnected');
            } catch (err) {
                logger.error('Error during shutdown', err);
            }
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            try {
                decayManager.stop();
                if (cleanupInterval) {
                    clearInterval(cleanupInterval);
                }
                await client.destroy();
                logger.info('✓ Discord client disconnected');
            } catch (err) {
                logger.error('Error during shutdown', err);
            }
            process.exit(0);
        });

        client.login(process.env.DISCORD_TOKEN);
    } catch (err) {
        logger.error('Failed to start bot', err);
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
        }
        process.exit(1);
    }
}

startBot();
