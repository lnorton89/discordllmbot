import { loadRelationships, saveRelationships } from '../storage/persistence.js'
import { getBotConfig } from '../config/configLoader.js'

// In-memory cache of relationships per guild: { guildId: { userId: { ... } } }
const guildRelationships = {}

export function getRelationship(guildId, userId) {
    return guildRelationships[guildId]?.[userId] ?? getDefaultRelationship()
}

export function setRelationship(guildId, guildName, userId, config) {
    guildRelationships[guildId] ??= {}
    guildRelationships[guildId][userId] = config
    
    // Persist this guild's relationships immediately
    saveGuildRelationships(guildId, guildName)
}

/**
 * Load relationships for a guild from disk and cache in memory
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name
 * @returns {Object} Relationships for the guild
 */
export function loadGuildRelationships(guildId, guildName) {
    const rels = loadRelationships(guildId, guildName)
    guildRelationships[guildId] = rels
    return rels
}

/**
 * Save all relationships for a guild to disk
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name
 */
export function saveGuildRelationships(guildId, guildName) {
    if (guildRelationships[guildId]) {
        saveRelationships(guildId, guildName, guildRelationships[guildId])
    }
}

function getDefaultRelationship() {
    const botConfig = getBotConfig()
    return botConfig.defaultRelationship ?? {
        attitude: 'neutral',
        behavior: [
            'treat them like a normal server regular'
        ],
        boundaries: []
    }
}

/**
 * Initialize relationships for a guild by enumerating members and
 * assigning the default relationship to users that do not already have one.
 * @param {Guild} guild - discord.js Guild object
 */
export async function initializeGuildRelationships(guild) {
    const guildId = guild.id
    const guildName = guild.name

    // Load existing relationships or start fresh
    if (!guildRelationships[guildId]) {
        loadGuildRelationships(guildId, guildName)
    } else {
        // Ensure in-memory map exists even if already loaded
        guildRelationships[guildId] ??= {}
    }

    // Try to fetch members; if not available due to intents, use cached members
    let members
    try {
        members = await guild.members.fetch()
    } catch (e) {
        members = guild.members.cache
    }

    const defaultRel = getDefaultRelationship()
    let changed = false

    for (const [memberId, member] of members) {
        // Skip bots
        if (member.user?.bot) continue

        const existing = guildRelationships[guildId][memberId]
        const displayName = member.displayName ?? member.user?.username ?? memberId
        const username = member.user?.username ?? memberId

        if (!existing) {
            guildRelationships[guildId][memberId] = {
                username,
                displayName,
                attitude: defaultRel.attitude,
                behavior: Array.isArray(defaultRel.behavior) ? [...defaultRel.behavior] : [],
                boundaries: Array.isArray(defaultRel.boundaries) ? [...defaultRel.boundaries] : []
            }
            changed = true
        } else {
            // Backfill missing fields
            if (!existing.username) {
                existing.username = username
                changed = true
            }
            if (!existing.displayName) {
                existing.displayName = displayName
                changed = true
            }
        }
    }

    if (changed) {
        saveGuildRelationships(guildId, guildName)
    }

    return guildRelationships[guildId]
}

/**
 * Expose function to get all relationships for inspection
 */
export function getAllRelationships() {
    return guildRelationships
}
