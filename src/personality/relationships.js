import { loadRelationships, saveRelationships } from '../../shared/storage/persistence.js'
import { getBotConfig } from '../../shared/config/configLoader.js'

// In-memory cache of relationships per guild: { guildId: { userId: { ... } } }
const guildRelationships = {}

/**
 * Retrieves the relationship configuration for a specific user in a guild.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} userId - The ID of the user.
 * @returns {Object} The relationship configuration object.
 */
export function getRelationship(guildId, userId) {
    return guildRelationships[guildId]?.[userId] ?? getDefaultRelationship()
}

/**
 * Sets the relationship configuration for a specific user in a guild.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} userId - The ID of the user.
 * @param {Object} config - The new relationship configuration.
 */
export function setRelationship(guildId, userId, config) {
    guildRelationships[guildId] ??= {};
    guildRelationships[guildId][userId] = config;
    saveGuildRelationships(guildId);
}

/**
 * Load relationships for a guild from disk and cache in memory
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name
 * @returns {Object} Relationships for the guild
 */
export function loadGuildRelationships(guildId) {
    const rels = loadRelationships(guildId);
    guildRelationships[guildId] = rels;
    return rels;
}

/**
 * Save all relationships for a guild to disk
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name
 */
export function saveGuildRelationships(guildId) {
    if (guildRelationships[guildId]) {
        saveRelationships(guildId, guildRelationships[guildId]);
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
    const guildId = guild.id;

    // Load all existing relationships from the DB for this guild.
    const existingRels = loadRelationships(guildId);
    guildRelationships[guildId] = existingRels;

    // Mark all existing relationships as potentially stale.
    const staleUsers = new Set(Object.keys(existingRels));

    let members;
    try {
        members = await guild.members.fetch();
    } catch (e) {
        members = guild.members.cache;
    }

    const defaultRel = getDefaultRelationship();
    let changed = false;

    for (const [memberId, member] of members) {
        if (member.user?.bot) continue;

        // This user is active, so remove them from the stale list.
        staleUsers.delete(memberId);

        const existing = guildRelationships[guildId][memberId];
        const displayName = member.displayName ?? member.user?.username ?? memberId;
        const username = member.user?.username ?? memberId;

        if (!existing) {
            // This is a new user, add them.
            guildRelationships[guildId][memberId] = {
                username,
                displayName,
                attitude: defaultRel.attitude,
                behavior: Array.isArray(defaultRel.behavior) ? [...defaultRel.behavior] : [],
                boundaries: Array.isArray(defaultRel.boundaries) ? [...defaultRel.boundaries] : []
            };
            changed = true;
        } else {
            // This is an existing user, just ensure their data is up-to-date.
            if (existing.username !== username || existing.displayName !== displayName) {
                existing.username = username;
                existing.displayName = displayName;
                changed = true;
            }
        }
    }

    // Remove stale users from the in-memory cache.
    if (staleUsers.size > 0) {
        for (const userId of staleUsers) {
            delete guildRelationships[guildId][userId];
        }
        changed = true;
    }

    // If anything changed, save the entire, corrected state back to the DB.
    if (changed) {
        saveGuildRelationships(guildId);
    }

    return guildRelationships[guildId];
}

/**
 * Expose function to get all relationships for inspection
 */
export function getAllRelationships() {
    return guildRelationships
}
