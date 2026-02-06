import { saveContext, loadContexts } from '../storage/persistence.js'
import { getMemoryConfig } from '../config/configLoader.js'

// In-memory cache of contexts per guild: { guildId: { channelId: [...messages] } }
const guildContexts = {}

export function addMessage(guildId, guildName, channelId, channelName, authorId, authorName, content) {
    guildContexts[guildId] ??= {}
    guildContexts[guildId][channelId] ??= []

    const { maxMessages } = getMemoryConfig()

    guildContexts[guildId][channelId].push({
        authorId,
        author: authorName,
        content
    })

    if (guildContexts[guildId][channelId].length > maxMessages) {
        guildContexts[guildId][channelId].shift()
    }

    // Persist this channel's context in the guild folder with readable channel name
    saveContext(guildId, guildName, channelId, channelName, guildContexts[guildId][channelId])
}

export function getContext(guildId, channelId) {
    return guildContexts[guildId]?.[channelId] ?? []
}

/**
 * Load all contexts for a guild from disk
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name
 */
export function loadGuildContexts(guildId, guildName) {
    const contexts = loadContexts(guildId, guildName)
    guildContexts[guildId] = contexts
    return contexts
}
