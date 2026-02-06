/**
 * Simple structured logging utility
 * Logs to console AND to file with timestamp and severity level
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_FILE = path.join(__dirname, '../../discordllmbot.log')

const LOG_LEVELS = {
    message: 'MESSAGE',
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR'
}

function timestamp() {
    const now = new Date()
    return now.toISOString()
}

function format(level, message, data = null) {
    const time = timestamp()
    const prefix = `[${time}] [${level}]`
    
    if (data) {
        return `${prefix} ${message}`, data
    }
    return `${prefix} ${message}`
}

function writeToFile(message) {
    try {
        fs.appendFileSync(LOG_FILE, message + '\n', 'utf-8')
    } catch (err) {
        // Silently fail if we can't write to file
        console.warn('Failed to write to log file:', err.message)
    }
}

export const logger = {
    message(message, data = null) {
        const formatted = format(LOG_LEVELS.message, message)
        if (data) {
            console.log(formatted, data)
            writeToFile(formatted)
        } else {
            console.log(formatted)
            writeToFile(formatted)
        }
    },

    info(message, data = null) {
        const formatted = format(LOG_LEVELS.info, message)
        if (data) {
            console.log(formatted, data)
            writeToFile(formatted)
        } else {
            console.log(formatted)
            writeToFile(formatted)
        }
    },

    warn(message, data = null) {
        const formatted = format(LOG_LEVELS.warn, message)
        if (data) {
            console.warn(formatted, data)
            writeToFile(formatted)
        } else {
            console.warn(formatted)
            writeToFile(formatted)
        }
    },

    error(message, error = null) {
        const formatted = format(LOG_LEVELS.error, message)
        if (error) {
            console.error(formatted, error)
            writeToFile(formatted)
            if (error.stack) {
                writeToFile(error.stack)
            }
        } else {
            console.error(formatted)
            writeToFile(formatted)
        }
    }
}

/**
 * Initialize logger - truncates/creates log file
 * Call this at app startup
 */
export function initializeLogger() {
    try {
        // Create fresh log file on startup
        fs.writeFileSync(LOG_FILE, '', 'utf-8')
        logger.info('Logger initialized')
    } catch (err) {
        console.error('Failed to initialize log file:', err)
    }
}
