import { logger } from '../../shared/utils/logger.js'
import { getApiConfig } from '../../shared/config/configLoader.js'

/**
 * Get Gemini API URL for the configured model
 */
function getGeminiUrl() {
    const { geminiModel } = getApiConfig()
    return `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`
}

/**
 * Custom error class for Gemini API errors
 */
export class GeminiAPIError extends Error {
    constructor(message, statusCode, retryable = false) {
        super(message)
        this.name = 'GeminiAPIError'
        this.statusCode = statusCode
        this.retryable = retryable
    }
}

/**
 * Check if an error is retryable (rate limit, timeout, server error)
 */
function isRetryable(error) {
    if (error instanceof GeminiAPIError) {
        return error.retryable
    }
    return error.message?.includes('timeout') || error.message?.includes('ECONNRESET')
}

/**
 * Exponential backoff retry logic
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise}
 */
async function retry(fn, maxRetries = 3, baseBackoffMs = 1000) {
    let lastError

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err

            if (!isRetryable(err)) {
                throw err
            }

            if (i < maxRetries - 1) {
                // Prefer honoring server-provided Retry-After when available
                let backoffMs = null
                if (err && typeof err.retryAfterMs === 'number') {
                    backoffMs = err.retryAfterMs
                }

                // Fallback to exponential backoff with jitter using configured base
                if (!backoffMs) {
                    backoffMs = Math.pow(2, i) * baseBackoffMs + Math.random() * Math.min(1000, baseBackoffMs)
                }

                logger.warn(`Retrying Gemini API (attempt ${i + 2}/${maxRetries}) after ${backoffMs}ms: ${err.message}${err.cause ? ` (Cause: ${err.cause.message})` : ''}`)
                await new Promise(r => setTimeout(r, backoffMs))
            }
        }
    }

    throw lastError
}

/**
 * Generate a reply from Gemini API with retry logic
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Promise<string|null>} Reply text or null if no content
 */
export async function generateReply(prompt) {
    const apiCfg = getApiConfig()
    const { geminiModel, retryAttempts = 3, retryBackoffMs = 1000 } = apiCfg

    return retry(async () => {
        const url = getGeminiUrl()
        const apiKey = process.env.GEMINI_API_KEY
        
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not set in environment')
        }

        // Minimal Gemini request log (no prompt preview or lengths)
        logger.api(`→ Gemini API Request: Model=${geminiModel} Function=generateReply()`)
        
        const res = await fetch(
            `${url}?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }]
                        }
                    ]
                })
            }
        )

        if (!res.ok) {
            const errorText = await res.text()
            const retryAfter = res.headers.get?.('retry-after') ?? null

            logger.error(`Gemini API error ${res.status}: ${errorText.substring(0, 200)}`)
            
            const isRetryable = res.status >= 500 || res.status === 429
            const error = new GeminiAPIError(
                `Gemini API error: ${res.status}${errorText ? `: ${errorText}` : ''}`,
                res.status,
                isRetryable
            )
            if (retryAfter) {
                // Try to interpret Retry-After as seconds when possible
                const seconds = Number.parseFloat(retryAfter)
                if (!Number.isNaN(seconds)) {
                    error.retryAfterMs = Math.round(seconds * 1000)
                } else {
                    // If header is a HTTP-date, we can't reliably parse it here;
                    // still attach the raw header so higher-level logic may inspect it.
                    error.retryAfter = retryAfter
                }
            }

            throw error
        }

        const data = await res.json()
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null
        
        // Do not log reply content or lengths here to avoid duplicating
        // message content in application logs. Caller will decide what to log.

        return reply
    }, retryAttempts, retryBackoffMs)
}

