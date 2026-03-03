/**
 * Qwen LLM Provider
 *
 * Uses Qwen OAuth authentication via portal.qwen.ai
 * Automatically refreshes token when 401 errors occur.
 */

import { logger } from '@shared/utils/logger.js';
import { getApiConfig, reloadConfig } from '@shared/config/configLoader.js';
import { URLS } from '@shared/constants';

interface ApiConfig {
    qwenModel?: string;
    qwenApiKey?: string;
    retryAttempts?: number;
    retryBackoffMs?: number;
}

interface UsageMetadata {
    promptTokenCount?: number | null;
    candidatesTokenCount?: number | null;
    totalTokenCount?: number;
}

interface QwenResponse {
    text: string | null;
    usageMetadata: UsageMetadata | null;
}

class QwenAPIError extends Error {
    statusCode: number;
    retryable: boolean;
    isAuthError: boolean;

    constructor(message: string, statusCode: number, retryable = false, isAuthError = false) {
        super(message);
        this.name = 'QwenAPIError';
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.isAuthError = isAuthError;
    }
}

function isRetryable(error: Error): boolean {
    if (error instanceof QwenAPIError) {
        // Don't retry auth errors - they need token refresh instead
        if (error.isAuthError) return false;
        return error.retryable;
    }
    return error.message?.includes('timeout') || error.message?.includes('ECONNRESET');
}

/**
 * Attempt to refresh Qwen OAuth token automatically.
 * Returns true if refresh was successful.
 */
async function refreshQwenToken(): Promise<boolean> {
    try {
        logger.info('Attempting automatic Qwen OAuth token refresh...');

        // Try to call the refresh endpoint on the API server
        const apiPort = process.env.API_PORT || '3000';
        const refreshUrl = `${URLS.DEV.API.replace('http://localhost', `http://localhost:${apiPort}`)}/api/llm/qwen/oauth/refresh`;
        
        const res = await fetch(refreshUrl, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        
        if (res.ok) {
            const data = await res.json() as { status?: string };
            if (data.status === 'refreshed') {
                // Reload config to get new token
                await reloadConfig();
                logger.info('Qwen OAuth token refreshed successfully');
                return true;
            }
        }
        
        logger.warn('Qwen OAuth token refresh failed - manual re-authentication required');
        return false;
    } catch (err) {
        logger.error('Qwen OAuth token refresh error', err);
        return false;
    }
}

async function retry<T>(fn: () => Promise<T>, maxRetries = 3, baseBackoffMs = 1000): Promise<T> {
    let lastError: Error;
    let tokenRefreshAttempted = false;
    const safeMaxRetries = Number.isFinite(maxRetries) ? Math.max(0, Math.floor(maxRetries)) : 3;
    const totalAttempts = safeMaxRetries + 1;

    for (let i = 0; i < totalAttempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err as Error;

            // Special handling for auth errors - try token refresh once
            if (lastError instanceof QwenAPIError && lastError.isAuthError && !tokenRefreshAttempted) {
                tokenRefreshAttempted = true;
                logger.warn('Qwen API auth error detected, attempting token refresh...');
                
                const refreshed = await refreshQwenToken();
                if (refreshed) {
                    logger.info('Token refreshed, retrying request...');
                    continue; // Retry immediately with new token
                }
                
                logger.error('Token refresh failed, cannot continue');
                throw lastError;
            }

            if (!isRetryable(lastError)) {
                throw lastError;
            }

            if (i < totalAttempts - 1) {
                const backoffMs = Math.pow(2, i) * baseBackoffMs + Math.random() * Math.min(1000, baseBackoffMs);
                logger.warn(`Retrying Qwen API (attempt ${i + 2}/${totalAttempts}) after ${backoffMs}ms: ${lastError.message}`);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }

    throw lastError!;
}

function getQwenBaseUrl(): string {
    return URLS.QWEN.PORTAL;
}

function resolveQwenApiKey(config: ApiConfig): string {
    const fromConfig = config.qwenApiKey?.trim();
    if (fromConfig) return fromConfig;

    const fromEnv = process.env.QWEN_API_KEY?.trim();
    if (fromEnv) return fromEnv;

    throw new Error('Qwen API key is not configured. Complete OAuth flow in dashboard.');
}

export async function generateReply(prompt: string): Promise<QwenResponse> {
    const apiCfg: ApiConfig = await getApiConfig();
    const qwenModel = apiCfg.qwenModel || 'qwen-plus';
    const retryAttempts = Number.isFinite(apiCfg.retryAttempts) ? Math.max(0, Math.floor(apiCfg.retryAttempts as number)) : 3;
    const retryBackoffMs = apiCfg.retryBackoffMs ?? 1000;

    return retry(async () => {
        const apiKey = resolveQwenApiKey(apiCfg);
        const url = `${getQwenBaseUrl()}/chat/completions`;

        logger.api(`→ Qwen API Request: Model=${qwenModel} Function=generateReply()`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'QwenCode/1.0 (DiscordBot)',
                'X-DashScope-CacheControl': 'enable',
                'X-DashScope-AuthType': 'qwen-oauth',
            },
            body: JSON.stringify({
                model: qwenModel,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            const isAuthError = res.status === 401 || res.status === 403;
            
            // Log the full error for debugging
            if (isAuthError) {
                logger.error('Qwen API authentication failed - token may be expired', {
                    statusCode: res.status,
                    error: errorText,
                });
            }
            
            throw new QwenAPIError(
                `Qwen API error: ${res.status}${errorText ? `: ${errorText}` : ''}`,
                res.status,
                res.status >= 500 || res.status === 429 || res.status === 408,
                isAuthError
            );
        }

        const data = await res.json() as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };

        return {
            text: data?.choices?.[0]?.message?.content ?? null,
            usageMetadata: {
                promptTokenCount: data?.usage?.prompt_tokens ?? null,
                candidatesTokenCount: data?.usage?.completion_tokens ?? null,
                totalTokenCount: data?.usage?.total_tokens,
            },
        };
    }, retryAttempts, retryBackoffMs);
}

export async function getAvailableModels(): Promise<string[]> {
    return ['coder-model', 'vision-model'];
}
