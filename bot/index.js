import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client, GatewayIntentBits, Partials } from 'discord.js'

import { validateEnvironment } from '../shared/config/validation.js'
import { logger, initializeLogger } from '../shared/utils/logger.js'
import { getBotConfig, getMemoryConfig } from '../shared/config/configLoader.js';

import { pruneOldMessages } from '../shared/storage/persistence.js';

// Event handlers
import { handleClientReady, handleMessageCreate, handleGuildCreate, handleGuildMemberAdd } from './events/index.js';

// Read config early to supply logger settings before initializing logger
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOT_CONFIG_PATH = path.join(process.cwd(), 'shared', 'config', 'bot.json')
let initialMaxLogLines = undefined
try {
    if (fs.existsSync(BOT_CONFIG_PATH)) {
        const cfg = JSON.parse(fs.readFileSync(BOT_CONFIG_PATH, 'utf-8'))
        initialMaxLogLines = cfg?.logger?.maxLogLines
    }
} catch (e) {
    // ignore parsing errors here; config loader will validate later
}

// Initialize logging to file (truncate to configured max lines on startup)
initializeLogger(initialMaxLogLines)

// Load config early for use throughout app
let botConfig
try {
    botConfig = getBotConfig()
} catch (err) {
    logger.error('Failed to load configuration', err)
    process.exit(1)
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
})

// Startup: Validate environment
try {
    validateEnvironment()
} catch (err) {
    logger.error('Startup failed', err)
    process.exit(1)
}

// Register event handlers
client.once('clientReady', () => {
    handleClientReady(client, botConfig);
    const { maxMessageAgeDays } = getMemoryConfig();
    pruneOldMessages(maxMessageAgeDays);
    setInterval(() => pruneOldMessages(maxMessageAgeDays), 1000 * 60 * 60 * 24); // Every 24 hours
});
client.on('messageCreate', (message) => handleMessageCreate(message, client))
client.on('guildCreate', handleGuildCreate)
client.on('guildMemberAdd', handleGuildMemberAdd)

// Graceful shutdown: Save state before exit
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...')
    try {
        await client.destroy()
        logger.info('✓ Discord client disconnected')
    } catch (err) {
        logger.error('Error during shutdown', err)
    }
    process.exit(0)
})

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...')
    try {
        await client.destroy()
        logger.info('✓ Discord client disconnected')
    } catch (err) {
        logger.error('Error during shutdown', err)
    }
    process.exit(0)
})

client.login(process.env.DISCORD_TOKEN)
