/**
 * Simple structured logging utility
 * Logs to console with timestamp and severity level
 */

const LOG_LEVELS = {
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

export const logger = {
    info(message, data = null) {
        if (data) {
            console.log(format(LOG_LEVELS.info, message), data)
        } else {
            console.log(format(LOG_LEVELS.info, message))
        }
    },

    warn(message, data = null) {
        if (data) {
            console.warn(format(LOG_LEVELS.warn, message), data)
        } else {
            console.warn(format(LOG_LEVELS.warn, message))
        }
    },

    error(message, error = null) {
        if (error) {
            console.error(format(LOG_LEVELS.error, message), error)
        } else {
            console.error(format(LOG_LEVELS.error, message))
        }
    }
}
