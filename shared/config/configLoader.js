import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../utils/logger.js'
import { getServerConfig as getDbServerConfig, saveServerConfig as saveDbServerConfig, getGlobalConfig, saveGlobalConfig } from '../storage/persistence.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = path.join(__dirname, 'bot.json')
const DEFAULTS_FILE = path.join(__dirname, 'bot.json.defaults')

let cachedConfig = null
const serverConfigCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Load default config template
const DEFAULT_GLOBAL_CONFIG = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf-8'))

// Create server-specific defaults that include replyBehavior but exclude global-only fields
const DEFAULT_SERVER_CONFIG = {
    ...DEFAULT_GLOBAL_CONFIG,
    // Override bot section to exclude description (since Discord only supports global description)
    bot: {
        ...DEFAULT_GLOBAL_CONFIG.bot,
        description: DEFAULT_GLOBAL_CONFIG.bot.description // Keep the global description as default but this will be overridden by global setting
    },
    replyBehavior: {
        mode: "mention-only",
        replyProbability: 1.0,
        minDelayMs: 500,
        maxDelayMs: 3000,
        ignoreUsers: [],
        ignoreChannels: [],
        ignoreKeywords: [],
        requireMention: true,
        engagementMode: "passive",
        proactiveReplyChance: 0.05
    }
}

// Create a version of the default server config that excludes bot description
function getServerConfigDefaults(globalConfig) {
    return {
        ...DEFAULT_SERVER_CONFIG,
        bot: {
            ...DEFAULT_SERVER_CONFIG.bot,
            // Use the global description instead of allowing server-specific description
            description: globalConfig?.bot?.description || DEFAULT_GLOBAL_CONFIG.bot.description
        }
        // replyBehavior is fully server-specific, no global merging needed
    };
}

/**
 * Load global bot configuration (for system-wide settings)
 * @returns {Object} Configuration object
 */
export async function loadConfig() {
    if (cachedConfig) return cachedConfig

    try {
        // First try to load from database
        let configFromDb = await getGlobalConfig();

        if (configFromDb) {
            cachedConfig = configFromDb;
            logger.info('✓ Loaded global config from database');
        } else {
            // If not in database, check if JSON file exists (migration scenario)
            if (fs.existsSync(CONFIG_FILE)) {
                const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
                const jsonConfig = JSON.parse(data);

                // Save to database and remove from JSON file for future loads
                await saveGlobalConfig(jsonConfig);
                cachedConfig = jsonConfig;

                logger.info('✓ Loaded global config from bot.json (and migrated to database)');
            } else {
                // Use defaults if neither database nor file exists
                cachedConfig = DEFAULT_GLOBAL_CONFIG;
                logger.info('✓ Using default global config');
            }
        }
        return cachedConfig;
    } catch (err) {
        logger.error('Failed to load global config', err);
        return DEFAULT_GLOBAL_CONFIG;
    }
}

/**
 * Get server-specific configuration
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Server configuration
 */
export async function getServerConfig(guildId) {
    if (!guildId) return DEFAULT_GLOBAL_CONFIG

    // Check cache
    const cached = serverConfigCache.get(guildId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.config
    }

    try {
        let serverConfig = await getDbServerConfig(guildId)

        if (!serverConfig) {
            // No server-specific config exists, create it using server-specific default config
            const globalConfig = await loadConfig();
            serverConfig = getServerConfigDefaults(globalConfig);
            await saveDbServerConfig(guildId, serverConfig)
            logger.info(`Created default configuration for new server: ${guildId}`)
        }

        // Cache the config
        serverConfigCache.set(guildId, {
            config: serverConfig,
            timestamp: Date.now()
        })

        return serverConfig
    } catch (err) {
        logger.error(`Failed to load server config for guild ${guildId}`, err)
        const globalConfig = await loadConfig();
        return getServerConfigDefaults(globalConfig);
    }
}

/**
 * Update server-specific configuration
 * @param {string} guildId - Discord guild ID
 * @param {Object} newConfig - New server configuration
 */
export async function updateServerConfig(guildId, newConfig) {
    try {
        await saveDbServerConfig(guildId, newConfig)
        serverConfigCache.delete(guildId)
        logger.info(`Updated server config for guild ${guildId}`)
    } catch (err) {
        logger.error(`Failed to update server config for guild ${guildId}`, err)
        throw err
    }
}

/**
 * Force reload of global configuration from database
 */
export async function reloadConfig() {
    cachedConfig = null
    return loadConfig()
}

/**
 * Get bot personality config for a specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Bot persona settings
 */
export async function getBotConfig(guildId) {
    const serverConfig = await getServerConfig(guildId)
    const globalConfig = await loadConfig();

    // Use global description but server-specific other bot settings
    return {
        ...serverConfig.bot,
        description: globalConfig.bot.description
    }
}

/**
 * Get memory settings for a specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Memory configuration
 */
export async function getMemoryConfig(guildId) {
    const config = await getServerConfig(guildId)
    return config.memory
}

/**
 * Get global memory settings
 * @returns {Promise<Object>} Global memory configuration
 */
export async function getGlobalMemoryConfig() {
    const config = await loadConfig();
    return config.memory;
}

/**
 * Get API settings (global)
 * @returns {Promise<Object>} API configuration
 */
export async function getApiConfig() {
    const config = await loadConfig()
    return config.api
}

/**
 * Get reply behavior settings for a specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Reply behavior configuration
 */
export async function getReplyBehavior(guildId) {
    const config = await getServerConfig(guildId)
    return config.replyBehavior ?? {}
}

/**
 * Get logger settings for a specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Logger configuration
 */
export async function getLoggerConfig(guildId) {
    const config = await getServerConfig(guildId)
    return config.logger ?? {}
}

/**
 * Clear cache when configuration is updated
 * @param {string} guildId - Discord guild ID
 */
export function clearServerConfigCache(guildId) {
    serverConfigCache.delete(guildId)
}
