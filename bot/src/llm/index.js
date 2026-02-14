import { generateReply as geminiGenerateReply, getAvailableModels as geminiGetAvailableModels } from './gemini.js';
import { generateReply as ollamaGenerateReply, getAvailableModels as ollamaGetAvailableModels } from './ollama.js';
import { getApiConfig } from '../../../shared/config/configLoader.js';
import { logger } from '../../../shared/utils/logger.js';

/**
 * Unified LLM provider interface
 */

/**
 * Generate a reply using the configured LLM provider
 * @param {string} prompt - The prompt to send to the LLM
 * @returns {Promise<{text: string|null, usageMetadata: Object|null}>} Reply text and usage metadata or null if no content
 */
export async function generateReply(prompt) {
    const apiConfig = await getApiConfig();
    const provider = apiConfig.provider || 'gemini'; // Default to gemini for backward compatibility

    switch (provider.toLowerCase()) {
        case 'gemini':
            logger.info(`Using Gemini provider for generateReply`);
            return await geminiGenerateReply(prompt);
        case 'ollama':
            logger.info(`Using Ollama provider for generateReply`);
            return await ollamaGenerateReply(prompt);
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

/**
 * Get available models from the configured LLM provider
 * @param {string} [overrideProvider] - Optional: override the configured provider
 * @returns {Promise<Array<string>>} List of available model names
 */
export async function getAvailableModels(overrideProvider) {
    const apiConfig = await getApiConfig();
    const provider = overrideProvider || apiConfig.provider || 'gemini'; // Default to gemini for backward compatibility

    switch (provider.toLowerCase()) {
        case 'gemini':
            logger.info(`Fetching models from Gemini provider`);
            return await geminiGetAvailableModels();
        case 'ollama':
            logger.info(`Fetching models from Ollama provider`);
            return await ollamaGetAvailableModels();
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

/**
 * Get the current provider name
 * @returns {string} Current provider name
 */
export async function getCurrentProvider() {
    const apiConfig = await getApiConfig();
    return apiConfig.provider || 'gemini'; // Default to gemini for backward compatibility
}

/**
 * Validate if the current provider configuration is valid
 * @returns {boolean} True if configuration is valid
 */
export async function validateProviderConfig() {
    const apiConfig = await getApiConfig();
    const provider = apiConfig.provider || 'gemini';

    switch (provider.toLowerCase()) {
        case 'gemini':
            return !!process.env.GEMINI_API_KEY;
        case 'ollama':
            return true; // Ollama doesn't require an API key, just URL availability
        default:
            return false;
    }
}