import fs from 'fs'
import path from 'path'
import { logger } from '../utils/logger.js'
import { fileURLToPath } from 'url'

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
 * Load relationships from relationships.json
 * @returns {Object} Relationships object keyed by guildId.userId
 */
export function loadRelationships() {
    ensureDataDir()
    const filePath = path.join(DATA_DIR, 'relationships.json')

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8')
            logger.info('Loaded relationships from relationships.json')
            return JSON.parse(data)
        }
        logger.info('No relationships.json found, starting fresh')
        return {}
    } catch (err) {
        logger.warn('Failed to load relationships.json', err)
        return {}
    }
}

/**
 * Save relationships to relationships.json
 * @param {Object} relationships - Relationships object to save
 */
export function saveRelationships(relationships) {
    ensureDataDir()
    const filePath = path.join(DATA_DIR, 'relationships.json')

    try {
        fs.writeFileSync(filePath, JSON.stringify(relationships, null, 2), 'utf-8')
        logger.info('Saved relationships to relationships.json')
    } catch (err) {
        logger.error('Failed to save relationships.json', err)
    }
}

/**
 * Load all contexts (one file per channel)
 * @returns {Object} Contexts object keyed by channelId
 */
export function loadContexts() {
    ensureDataDir()
    const contextsDir = path.join(DATA_DIR, 'contexts')
    const contexts = {}

    // Create contexts subdirectory if it doesn't exist
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
                logger.warn(`Failed to load context for channel ${channelId}`, err)
            }
        })

        logger.info(`Loaded ${files.length} channel contexts`)
        return contexts
    } catch (err) {
        logger.warn('Failed to load contexts', err)
        return contexts
    }
}

/**
 * Save context for a specific channel
 * @param {string} channelId - Discord channel ID
 * @param {Array} messages - Array of messages to save
 */
export function saveContext(channelId, messages) {
    ensureDataDir()
    const contextsDir = path.join(DATA_DIR, 'contexts')

    if (!fs.existsSync(contextsDir)) {
        fs.mkdirSync(contextsDir, { recursive: true })
    }

    const filePath = path.join(contextsDir, `${channelId}.json`)

    try {
        fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf-8')
    } catch (err) {
        logger.error(`Failed to save context for channel ${channelId}`, err)
    }
}

/**
 * Delete context for a specific channel (cleanup)
 * @param {string} channelId - Discord channel ID
 */
export function deleteContext(channelId) {
    const contextsDir = path.join(DATA_DIR, 'contexts')
    const filePath = path.join(contextsDir, `${channelId}.json`)

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
    } catch (err) {
        logger.warn(`Failed to delete context for channel ${channelId}`, err)
    }
}
