/**
 * Gemini LLM Provider
 *
 * Implementation for Google's Gemini API with retry logic
 * and exponential backoff for rate limiting.
 *
 * @module bot/src/llm/gemini
 */

import { logger } from '@shared/utils/logger.js';
import { getApiConfig } from '@shared/config/configLoader.js';
import { URLS } from '@shared/constants';

/**
 * API configuration for Gemini.
 */
interface ApiConfig {
    geminiModel?: string;
    retryAttempts?: number;
    retryBackoffMs?: number;
    geminiApiKey?: string;
}

/**
 * Gets the Gemini API URL for the configured model.
 *
 * @returns Promise resolving to the API URL
 */
async function getGeminiUrl(): Promise<string> {
    const config: ApiConfig = await getApiConfig();
    const geminiModel = config.geminiModel || 'gemini-2.0-flash';
    return `${URLS.GEMINI.BASE}/${geminiModel}:generateContent`;
}

/**
 * Error class for Gemini API errors with retry support.
 */
export class GeminiAPIError extends Error {
    statusCode: number;
    retryable: boolean;
    retryAfterMs?: number;
    retryAfter?: string;

    constructor(message: string, statusCode: number, retryable = false) {
        super(message);
        this.name = 'GeminiAPIError';
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

/**
 * Determines if an error is retryable.
 * 
 * @param error - The error to check
 * @returns True if the error should trigger a retry
 */
function isRetryable(error: Error): boolean {
    if (error instanceof GeminiAPIError) {
        return error.retryable;
    }
    return error.message?.includes('timeout') || error.message?.includes('ECONNRESET');
}

/**
 * Retries a function with exponential backoff.
 * 
 * @param fn - The function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseBackoffMs - Base backoff time in milliseconds
 * @returns Promise resolving to the function result
 */
async function retry<T>(fn: () => Promise<T>, maxRetries = 3, baseBackoffMs = 1000): Promise<T> {
    let lastError: Error;

    const safeMaxRetries = Number.isFinite(maxRetries) ? Math.max(0, Math.floor(maxRetries)) : 3;
    const totalAttempts = safeMaxRetries + 1;
    
    for (let i = 0; i < totalAttempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err as Error;

            if (!isRetryable(lastError)) {
                throw lastError;
            }

            if (i < totalAttempts - 1) {
                let backoffMs: number | null = null;
                if (lastError && typeof (lastError as GeminiAPIError).retryAfterMs === 'number') {
                    backoffMs = (lastError as GeminiAPIError).retryAfterMs ?? null;
                }

                if (backoffMs === null || backoffMs === undefined) {
                    backoffMs = Math.pow(2, i) * baseBackoffMs + Math.random() * Math.min(1000, baseBackoffMs);
                }

                logger.warn(`Retrying Gemini API (attempt ${i + 2}/${totalAttempts}) after ${backoffMs}ms: ${lastError.message}${lastError.cause ? ` (Cause: ${(lastError.cause as Error).message})` : ''}`);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }

    throw lastError!;
}

interface UsageMetadata {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
}

interface GeminiResponse {
    text: string | null;
    usageMetadata: UsageMetadata | null;
}

/**
 * Generates a reply using the Gemini API.
 * Includes automatic retry with exponential backoff for rate limits.
 * 
 * @param prompt - The prompt string to send to Gemini
 * @returns Promise resolving to the Gemini response with text and token counts
 */
export async function generateReply(prompt: string): Promise<GeminiResponse> {
    const apiCfg: ApiConfig = await getApiConfig();
    const { geminiModel, retryBackoffMs = 1000 } = apiCfg;
    const retryAttempts = Number.isFinite(apiCfg.retryAttempts) ? Math.max(0, Math.floor(apiCfg.retryAttempts as number)) : 3;

    return retry(async () => {
        const url = await getGeminiUrl();
        const apiKey = apiCfg.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('Gemini API key not configured. Set llm.geminiApiKey in dashboard or GEMINI_API_KEY in env.');
        }

        logger.api(`→ Gemini API Request: Model=${geminiModel} Function=generateReply()`);

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
        );

        if (!res.ok) {
            const errorText = await res.text();
            const retryAfter = res.headers.get?.('retry-after') ?? null;

            const isRetryable = res.status >= 500 || res.status === 429;
            if (!isRetryable) {
                logger.error(`Gemini API error ${res.status}: ${errorText.substring(0, 200)}`);
            }

            const error = new GeminiAPIError(
                `Gemini API error: ${res.status}${errorText ? `: ${errorText}` : ''}`,
                res.status,
                isRetryable
            );
            if (retryAfter) {
                const seconds = Number.parseFloat(retryAfter);
                if (!Number.isNaN(seconds)) {
                    error.retryAfterMs = Math.round(seconds * 1000);
                } else {
                    error.retryAfter = retryAfter;
                }
            }

            throw error;
        }

        const data = await res.json() as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{ text?: string }>
                }
            }>;
            usageMetadata?: UsageMetadata;
        };
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        const usageMetadata = data?.usageMetadata || null;
        
        return { text: reply, usageMetadata };
    }, retryAttempts, retryBackoffMs);
}

/**
 * Gets available models from Gemini API.
 * 
 * @returns Promise resolving to array of available model names
 */
export async function getAvailableModels(): Promise<string[]> {
    const apiCfg: ApiConfig = await getApiConfig();
    const apiKey = apiCfg.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Gemini API key not configured. Set llm.geminiApiKey in dashboard or GEMINI_API_KEY in env.');
    }

    try {
        const res = await fetch(`${URLS.GEMINI.BASE}?key=${apiKey}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new GeminiAPIError(
                `Gemini API error fetching models: ${res.status}${errorText ? `: ${errorText}` : ''}`,
                res.status,
                res.status >= 500 || res.status === 429
            );
        }

        const data = await res.json() as {
            models?: Array<{
                name?: string;
                supportedGenerationMethods?: string[];
            }>
        };

        const models = data.models
            ?.filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name?.replace('models/', '')) as string[] || [];

        logger.api(`→ Gemini API Request: Function=getAvailableModels() - Found ${models.length} models`);
        
        return models;
    } catch (err) {
        logger.error('Failed to fetch Gemini models', err);
        throw err;
    }
}
