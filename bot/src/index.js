import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { validateEnvironment } from '../../shared/config/validation.js';
import { logger, initializeLogger } from '../../shared/utils/logger.js';
import { getBotConfig, getMemoryConfig } from '../../shared/config/configLoader.js';
import { pruneOldMessages } from '../../shared/storage/persistence.js';
import { handleClientReady, handleMessageCreate, handleGuildCreate, handleGuildMemberAdd } from './events/index.js';
import { startApi } from './api/server.js';

// Initialize logging to file with default settings
initializeLogger(undefined);

// Async function to handle startup
async function startBot() {
    let cleanupInterval = null;
    
    try {
        // For initial logger settings, we'll use a synchronous approach to read the file if it exists
        // This is only for the initial logger setup, the actual config will come from the database
        const BOT_CONFIG_PATH = path.join(process.cwd(), 'shared', 'config', 'bot.json');
        let initialMaxLogLines = undefined;
        if (fs.existsSync(BOT_CONFIG_PATH)) {
            const cfg = JSON.parse(fs.readFileSync(BOT_CONFIG_PATH, 'utf-8'));
            initialMaxLogLines = cfg?.logger?.maxLogLines;
            // Re-initialize logger with the actual config if it was in the file
            if (initialMaxLogLines !== undefined) {
                initializeLogger(initialMaxLogLines);
            }
        }

        // Now load the actual config from database (async)
        const { loadConfig, getGlobalMemoryConfig } = await import('../../shared/config/configLoader.js');
        const fullConfig = await loadConfig();
        const botConfig = fullConfig.bot;

        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ],
            partials: [Partials.Channel]
        });

        // Startup: Validate environment
        validateEnvironment();

        // Register event handlers
        client.once('clientReady', async () => {
            handleClientReady(client, botConfig);
            // Note: getMemoryConfig is now async, so we need to handle this differently
            // We'll call it when needed in the interval instead of at startup
            cleanupInterval = setInterval(async () => {
                try {
                    const memoryConfig = await getGlobalMemoryConfig();
                    await pruneOldMessages(memoryConfig.maxMessageAgeDays);
                } catch (err) {
                    logger.error('Error during message pruning', err);
                }
            }, 1000 * 60 * 60 * 24); // Every 24 hours
        });
        client.on('messageCreate', (message) => handleMessageCreate(message, client));
        client.on('guildCreate', handleGuildCreate);
        client.on('guildMemberAdd', handleGuildMemberAdd);

        // Start the API server
        startApi(client);

        // Graceful shutdown: Save state before exit
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            try {
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
        // Clean up interval if it was set before the error
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
        }
        process.exit(1);
    }
}

startBot();
