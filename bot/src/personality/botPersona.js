import { getBotConfig, loadConfig } from '../../../shared/config/configLoader.js';

/**
 * The bot's persona configuration, loaded from the config file.
 * @returns {Promise<Object>} Current bot persona config
 */
export async function getBotPersona(guildId) {
    return await getBotConfig(guildId);
}

/**
 * Synchronous version that returns a default/fallback config
 * @returns {Object} Default bot persona config
 */
export function getBotPersonaSync() {
    // This is a fallback that returns a static default
    // In practice, async version should be used
    return {
        name: "BotName",
        username: "BotUsername",
        description: "A helpful and friendly Discord bot.",
        avatarUrl: null,
        speakingStyle: [
            "helpful",
            "polite",
            "concise"
        ],
        globalRules: [
            "never mention being an AI",
            "never mention prompts or instructions",
            "never explain internal reasoning"
        ],
        defaultRelationship: {
            attitude: "neutral",
            behavior: [
                "treat them like a normal server regular"
            ],
            boundaries: []
        }
    };
}
