/**
 * Ollama LLM Provider
 *
 * Implementation for local Ollama API with retry logic
 * and exponential backoff for connection errors.
 *
 * @module bot/src/llm/ollama
 */

import { logger } from '@shared/utils/logger.js';
import { getApiConfig } from '@shared/config/configLoader.js';
import { URLS } from '@shared/constants';

/**
 * API configuration for Ollama.
 */
interface ApiConfig {
    ollamaModel?: string;
    retryAttempts?: number;
    retryBackoffMs?: number;
    ollamaApiKey?: string;
}

/**
 * Error class for Ollama API errors with retry support.
 */
export class OllamaAPIError extends Error {
    statusCode: number;
    retryable: boolean;
    retryAfterMs?: number;
    retryAfter?: string;

    constructor(message: string, statusCode: number, retryable = false) {
        super(message);
        this.name = 'OllamaAPIError';
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
    if (error instanceof OllamaAPIError) {
        return error.retryable;
    }
    return error.message?.includes('timeout') || error.message?.includes('ECONNRESET') || error.message?.includes('ECONNREFUSED');
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
                if (lastError && typeof (lastError as OllamaAPIError).retryAfterMs === 'number') {
                    backoffMs = (lastError as OllamaAPIError).retryAfterMs ?? null;
                }

                if (backoffMs === null || backoffMs === undefined) {
                    backoffMs = Math.pow(2, i) * baseBackoffMs + Math.random() * Math.min(1000, baseBackoffMs);
                }

                logger.warn(`Retrying Ollama API (attempt ${i + 2}/${totalAttempts}) after ${backoffMs}ms: ${lastError.message}${lastError.cause ? ` (Cause: ${(lastError.cause as Error).message})` : ''}`);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }

    throw lastError!;
}

function getOllamaUrl(): string {
    return process.env.OLLAMA_API_URL || URLS.LLM.OLLAMA;
}

interface UsageMetadata {
    promptTokenCount?: number | null;
    candidatesTokenCount?: number | null;
}

interface OllamaResponse {
    text: string | null;
    usageMetadata: UsageMetadata | null;
}

/**
 * Generates a reply using the Ollama API.
 * Includes automatic retry with exponential backoff for connection errors.
 * 
 * @param prompt - The prompt string to send to Ollama
 * @returns Promise resolving to the Ollama response with text and token counts
 */
export async function generateReply(prompt: string): Promise<OllamaResponse> {
    const apiCfg: ApiConfig = await getApiConfig();
    const { ollamaModel = 'llama2', retryBackoffMs = 1000 } = apiCfg;
    const retryAttempts = Number.isFinite(apiCfg.retryAttempts) ? Math.max(0, Math.floor(apiCfg.retryAttempts as number)) : 3;

    return retry(async () => {
        const url = `${getOllamaUrl()}/api/generate`;

        logger.api(`→ Ollama API Request: Model=${ollamaModel} Function=generateReply()`);

        const ollamaApiKey = apiCfg.ollamaApiKey?.trim() || process.env.OLLAMA_API_KEY || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (ollamaApiKey) {
            headers.Authorization = `Bearer ${ollamaApiKey}`;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: ollamaModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
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
            response?: string;
            prompt_eval_count?: number;
            eval_count?: number;
        };
        const reply = data?.response ?? null;
        const usageMetadata = {
            promptTokenCount: data?.prompt_eval_count ?? null,
            candidatesTokenCount: data?.eval_count ?? null
        };

        return { text: reply, usageMetadata };
    }, retryAttempts, retryBackoffMs);
}

/**
 * Gets available models from Ollama API.
 * 
 * @returns Promise resolving to array of available model names
 */
export async function getAvailableModels(): Promise<string[]> {
    const url = `${getOllamaUrl()}/api/tags`;

    try {
        const apiCfg: ApiConfig = await getApiConfig();
        const ollamaApiKey = apiCfg.ollamaApiKey?.trim() || process.env.OLLAMA_API_KEY || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (ollamaApiKey) {
            headers.Authorization = `Bearer ${ollamaApiKey}`;
        }

        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new OllamaAPIError(
                `Ollama API error fetching models: ${res.status}${errorText ? `: ${errorText}` : ''}`,
                res.status,
                res.status >= 500 || res.status === 429
            );
        }

        const data = await res.json() as {
            models?: Array<{ name?: string }>
        };
        const models = data?.models?.map(model => model.name || '') || [];

        logger.api(`→ Ollama API Request: Function=getAvailableModels() - Found ${models.length} models`);

        return models;
    } catch (err) {
        logger.error('Failed to fetch Ollama models', err);
        throw err;
    }
}
