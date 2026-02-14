import { saveMessage } from '../../../shared/storage/persistence.js';
import { getMemoryConfig } from '../../../shared/config/configLoader.js';

const guildContexts = {};

/**
 * Adds a message to the in-memory context and persists it to the database.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} channelId - The ID of the channel.
 * @param {string} authorId - The ID of the message author.
 * @param {string} authorName - The username of the message author.
 * @param {string} content - The content of the message.
 * @returns {Promise<void>}
 */
export async function addMessage(guildId, channelId, authorId, authorName, content) {
    guildContexts[guildId] ??= {};
    guildContexts[guildId][channelId] ??= [];

    const { maxMessages } = await getMemoryConfig();

    const message = { authorId, author: authorName, content };
    guildContexts[guildId][channelId].push(message);

    if (guildContexts[guildId][channelId].length > maxMessages) {
        guildContexts[guildId][channelId].shift();
    }

    await saveMessage(guildId, channelId, authorId, authorName, content);
}

/**
 * Retrieves the current in-memory context for a specific channel.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} channelId - The ID of the channel.
 * @returns {Array<Object>} An array of message objects.
 */
export function getContext(guildId, channelId) {
    return guildContexts[guildId]?.[channelId] ?? [];
}

/**
 * Initializes the context storage for a guild.
 *
 * @param {string} guildId - The ID of the guild.
 */
export function loadGuildContexts(guildId) {
    // Since we are now loading contexts on a per-channel basis, this function can be simplified.
    // We will load the context for each channel as it is needed.
    guildContexts[guildId] = {};
}
