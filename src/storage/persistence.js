import fs from 'fs'
import path from 'path'
import { logger } from '../utils/logger.js'
import { fileURLToPath } from 'url'
import { sanitizeName } from '../utils/sanitizeName.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')

/**
 * Ensures data directory exists
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true })
        logger.info(`Created data directory: ${DATA_DIR}`)
    }
}

/**
 * Load relationships for a guild from guild-specific relationships.json
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name (will be sanitized for folder)
 * @returns {Object} Relationships object keyed by userId
 */
export function loadRelationships(guildId, guildName) {
    ensureDataDir()
    const sanitized = sanitizeName(guildName)
    const guildDir = path.join(DATA_DIR, sanitized)
    const filePath = path.join(guildDir, 'relationships.json')

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8')
            logger.info(`Loaded relationships from ${sanitized}/relationships.json`)
            return JSON.parse(data)
        }
        logger.info(`No relationships.json found for server ${sanitized}, starting fresh`)
        return {}
    } catch (err) {
        logger.warn(`Failed to load relationships for server ${sanitized}`, err)
        return {}
    }
}

/**
 * Save relationships for a guild to guild-specific relationships.json
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name (will be sanitized for folder)
 * @param {Object} relationships - Relationships object to save
 */
export function saveRelationships(guildId, guildName, relationships) {
    ensureDataDir()
    const sanitized = sanitizeName(guildName)
    const guildDir = path.join(DATA_DIR, sanitized)

    if (!fs.existsSync(guildDir)) {
        fs.mkdirSync(guildDir, { recursive: true })
    }

    const filePath = path.join(guildDir, 'relationships.json')

    try {
        fs.writeFileSync(filePath, JSON.stringify(relationships, null, 2), 'utf-8')
        logger.info(`Saved relationships to ${sanitized}/relationships.json`)
    } catch (err) {
        logger.error(`Failed to save relationships for server ${sanitized}`, err)
    }
}

/**
 * Load all contexts for a guild (one file per channel per user)
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name (will be sanitized for folder)
 * @returns {Object} Contexts object keyed by channelId
 */
export function loadContexts(guildId, guildName) {
    ensureDataDir()
    const sanitized = sanitizeName(guildName)
    const guildDir = path.join(DATA_DIR, sanitized)
    const contextsDir = path.join(guildDir, 'contexts')
    const contexts = {}

    if (!fs.existsSync(contextsDir)) {
        fs.mkdirSync(contextsDir, { recursive: true })
        return contexts
    }

    try {
        const files = fs.readdirSync(contextsDir).filter(f => f.endsWith('.json'))

        files.forEach(file => {
            const channelId = file.replace('.json', '')
            try {
                const data = fs.readFileSync(path.join(contextsDir, file), 'utf-8')
                contexts[channelId] = JSON.parse(data)
            } catch (err) {
                logger.warn(`Failed to load context for channel ${channelId} in server ${sanitized}`, err)
            }
        })

        if (files.length > 0) {
            logger.info(`Loaded ${files.length} channel contexts for server ${sanitized}`)
        }
        return contexts
    } catch (err) {
        logger.warn(`Failed to load contexts for server ${sanitized}`, err)
        return contexts
    }
}

/**
 * Save context for a specific channel in a guild
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name (will be sanitized for folder)
 * @param {string} channelId - Discord channel ID (used as backup; channelName preferred)
 * @param {string} channelName - Discord channel name (will be sanitized for filename)
 * @param {Array} messages - Array of messages to save
 */
export function saveContext(guildId, guildName, channelId, channelName, messages) {
    ensureDataDir()
    const sanitized = sanitizeName(guildName)
    const guildDir = path.join(DATA_DIR, sanitized)
    const contextsDir = path.join(guildDir, 'contexts')

    if (!fs.existsSync(contextsDir)) {
        fs.mkdirSync(contextsDir, { recursive: true })
    }

    // Use sanitized channel name for readable filenames; fallback to ID if no name
    const fileName = channelName ? sanitizeName(channelName) : channelId
    const filePath = path.join(contextsDir, `${fileName}.json`)

    try {
        fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf-8')
    } catch (err) {
        logger.error(`Failed to save context for channel ${channelName || channelId} in server ${sanitized}`, err)
    }
}

/**
 * Delete context for a specific channel in a guild (cleanup)
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name (will be sanitized for folder)
 * @param {string} channelId - Discord channel ID (used as backup)
 * @param {string} channelName - Discord channel name (will be sanitized for filename)
 */
export function deleteContext(guildId, guildName, channelId, channelName) {
    const sanitized = sanitizeName(guildName)
    const guildDir = path.join(DATA_DIR, sanitized)
    const contextsDir = path.join(guildDir, 'contexts')
    const fileName = channelName ? sanitizeName(channelName) : channelId
    const filePath = path.join(contextsDir, `${fileName}.json`)

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
    } catch (err) {
        logger.warn(`Failed to delete context for channel ${channelName || channelId} in server ${sanitized}`, err)
    }
}
