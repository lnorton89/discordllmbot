import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../utils/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = path.join(__dirname, 'bot.json')

let cachedConfig = null

/**
 * Load bot configuration from bot.json
 * @returns {Object} Configuration object
 */
export function loadConfig() {
    if (cachedConfig) return cachedConfig

    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8')
        cachedConfig = JSON.parse(data)
        logger.info('✓ Loaded config from bot.json')
        return cachedConfig
    } catch (err) {
        logger.error('Failed to load config/bot.json', err)
        throw new Error('Cannot start without valid config/bot.json')
    }
}

/**
 * Force reload of configuration from disk
 */
export function reloadConfig() {
    cachedConfig = null
    return loadConfig()
}

/**
 * Get bot personality config
 * @returns {Object} Bot persona settings
 */
export function getBotConfig() {
    const config = loadConfig()
    return config.bot
}

/**
 * Get memory settings
 * @returns {Object} Memory configuration
 */
export function getMemoryConfig() {
    const config = loadConfig()
    return config.memory
}

/**
 * Get API settings
 * @returns {Object} API configuration
 */
export function getApiConfig() {
    const config = loadConfig()
    return config.api
}

/**
 * Get reply behavior settings
 * @returns {Object} Reply behavior configuration
 */
export function getReplyBehavior() {
    const config = loadConfig()
    return config.replyBehavior ?? {}
}

/**
 * Get logger settings
 * @returns {Object} Logger configuration
 */
export function getLoggerConfig() {
    const config = loadConfig();
    return config.logger ?? {};
}
