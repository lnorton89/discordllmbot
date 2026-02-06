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
    api: 'API',
    message: 'MESSAGE',
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR'
}

let MAX_LOG_LINES = 1000

function timestamp() {
    const now = new Date()
    return now.toISOString()
}

function format(level, message, data = null) {
    const time = timestamp()
    const prefix = `[${time}] [${level}]`
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
    api(message, data = null) {
        const formatted = format(LOG_LEVELS.api, message)
        if (data) {
            console.log(formatted, data)
            writeToFile(formatted + ' ' + JSON.stringify(data))
        } else {
            console.log(formatted)
            writeToFile(formatted)
        }
    },

    message(message, data = null) {
        const formatted = format(LOG_LEVELS.message, message)
        if (data) {
            console.log(formatted, data)
            writeToFile(formatted + ' ' + JSON.stringify(data))
        } else {
            console.log(formatted)
            writeToFile(formatted)
        }
    },

    info(message, data = null) {
        const formatted = format(LOG_LEVELS.info, message)
        if (data) {
            console.log(formatted, data)
            writeToFile(formatted + ' ' + JSON.stringify(data))
        } else {
            console.log(formatted)
            writeToFile(formatted)
        }
    },

    warn(message, data = null) {
        const formatted = format(LOG_LEVELS.warn, message)
        if (data) {
            console.warn(formatted, data)
            writeToFile(formatted + ' ' + JSON.stringify(data))
        } else {
            console.warn(formatted)
            writeToFile(formatted)
        }
    },

    error(message, error = null) {
        const formatted = format(LOG_LEVELS.error, message)
        if (error) {
            console.error(formatted, error)
            writeToFile(formatted + ' ' + (error && error.stack ? error.stack : JSON.stringify(error)))
            if (error.stack) {
                // already written above
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
export function initializeLogger(maxLines) {
    if (typeof maxLines === 'number' && maxLines > 0) {
        MAX_LOG_LINES = Math.floor(maxLines)
    }

    try {
        // Truncate log file to the last MAX_LOG_LINES lines instead of wiping
        if (fs.existsSync(LOG_FILE)) {
            try {
                const content = fs.readFileSync(LOG_FILE, 'utf-8')
                const lines = content.split(/\r?\n/)
                const start = Math.max(0, lines.length - MAX_LOG_LINES)
                const truncated = lines.slice(start).join('\n')
                fs.writeFileSync(LOG_FILE, truncated + (truncated.endsWith('\n') ? '' : '\n'), 'utf-8')
            } catch (e) {
                // If truncation fails, fall back to creating/overwriting the file
                try { fs.writeFileSync(LOG_FILE, '', 'utf-8') } catch (_) {}
            }
        } else {
            // Create empty log file
            fs.writeFileSync(LOG_FILE, '', 'utf-8')
        }

        logger.info('Logger initialized')
    } catch (err) {
        console.error('Failed to initialize log file:', err)
    }
}
