import { logger } from '../../../shared/utils/logger.js';
import { getApiConfig } from '../../../shared/config/configLoader.js';

/**
 * Custom error class for Ollama API errors
 */
export class OllamaAPIError extends Error {
    constructor(message, statusCode, retryable = false) {
        super(message);
        this.name = 'OllamaAPIError';
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

/**
 * Check if an error is retryable (connection issues, timeouts, server errors)
 */
function isRetryable(error) {
    if (error instanceof OllamaAPIError) {
        return error.retryable;
    }
    return error.message?.includes('timeout') || error.message?.includes('ECONNRESET') || error.message?.includes('ECONNREFUSED');
}

/**
 * Exponential backoff retry logic
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseBackoffMs - Base backoff time in milliseconds
 * @returns {Promise}
 */
async function retry(fn, maxRetries = 3, baseBackoffMs = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;

            if (!isRetryable(err)) {
                throw err;
            }

            if (i < maxRetries - 1) {
                // Prefer honoring server-provided Retry-After when available
                let backoffMs = null;
                if (err && typeof err.retryAfterMs === 'number') {
                    backoffMs = err.retryAfterMs;
                }

                // Fallback to exponential backoff with jitter using configured base
                if (!backoffMs) {
                    backoffMs = Math.pow(2, i) * baseBackoffMs + Math.random() * Math.min(1000, baseBackoffMs);
                }

                logger.warn(`Retrying Ollama API (attempt ${i + 2}/${maxRetries}) after ${backoffMs}ms: ${err.message}${err.cause ? ` (Cause: ${err.cause.message})` : ''}`);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }

    throw lastError;
}

/**
 * Get Ollama API URL from environment or use default
 */
function getOllamaUrl() {
    return process.env.OLLAMA_API_URL || 'http://localhost:11434';
}

/**
 * Generate a reply from Ollama API with retry logic
 * @param {string} prompt - The prompt to send to Ollama
 * @returns {Promise<{text: string|null, usageMetadata: Object|null}>} Reply text and usage metadata or null if no content
 */
export async function generateReply(prompt) {
    const apiCfg = await getApiConfig();
    const { ollamaModel, retryAttempts = 3, retryBackoffMs = 1000 } = apiCfg;

    return retry(async () => {
        const url = `${getOllamaUrl()}/api/generate`;

        // Minimal Ollama request log (no prompt preview or lengths)
        logger.api(`→ Ollama API Request: Model=${ollamaModel} Function=generateReply()`);

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: ollamaModel,
                prompt: prompt,
                stream: false, // We want synchronous response
                options: {
                    temperature: 0.7, // Default temperature, can be configurable
                }
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            const retryAfter = res.headers.get?.('retry-after') ?? null;

            logger.error(`Ollama API error ${res.status}: ${errorText.substring(0, 200)}`);

            const isRetryable = res.status >= 500 || res.status === 429 || res.status === 408;
            const error = new OllamaAPIError(
                `Ollama API error: ${res.status}${errorText ? `: ${errorText}` : ''}`,
                res.status,
                isRetryable
            );
            if (retryAfter) {
                // Try to interpret Retry-After as seconds when possible
                const seconds = Number.parseFloat(retryAfter);
                if (!Number.isNaN(seconds)) {
                    error.retryAfterMs = Math.round(seconds * 1000);
                } else {
                    // If header is a HTTP-date, we can't reliably parse it here;
                    // still attach the raw header so higher-level logic may inspect it.
                    error.retryAfter = retryAfter;
                }
            }

            throw error;
        }

        const data = await res.json();
        const reply = data?.response ?? null;
        const usageMetadata = {
            promptTokenCount: data?.prompt_eval_count || null,
            candidatesTokenCount: data?.eval_count || null
        };

        // Do not log reply content or lengths here to avoid duplicating
        // message content in application logs. Caller will decide what to log.

        return { text: reply, usageMetadata };
    }, retryAttempts, retryBackoffMs);
}

/**
 * Fetch available models from Ollama API
 * @returns {Promise<Array<string>>} List of available model names
 */
export async function getAvailableModels() {
    const url = `${getOllamaUrl()}/api/tags`;

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new OllamaAPIError(
                `Ollama API error fetching models: ${res.status}${errorText ? `: ${errorText}` : ''}`,
                res.status,
                res.status >= 500 || res.status === 429
            );
        }

        const data = await res.json();
        // Extract model names from the response
        const models = data?.models?.map(model => model.name) || [];

        logger.api(`→ Ollama API Request: Function=getAvailableModels() - Found ${models.length} models`);

        return models;
    } catch (err) {
        logger.error('Failed to fetch Ollama models', err);
        throw err;
    }
}