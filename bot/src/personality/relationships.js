import { loadRelationships, saveRelationships, saveGuild } from '../../../shared/storage/persistence.js'
import { getBotConfig } from '../../../shared/config/configLoader.js'

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
export function setRelationship(guildId, guildName, userId, config) {
    guildRelationships[guildId] ??= {};
    guildRelationships[guildId][userId] = config;
    saveGuildRelationships(guildId, guildName);
}

/**
 * Load relationships for a guild from disk and cache in memory
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Relationships for the guild
 */
export async function loadGuildRelationships(guildId) {
    const rels = await loadRelationships(guildId);
    guildRelationships[guildId] = rels;
    return rels;
}

/**
 * Save all relationships for a guild to disk
 * @param {string} guildId - Discord guild ID
 */
export async function saveGuildRelationships(guildId, guildName) {
    if (guildRelationships[guildId]) {
        await saveRelationships(guildId, guildName, guildRelationships[guildId]);
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
    const guildName = guild.name;

    // Save guild info to the guilds table
    await saveGuild(guildId, guildName);

    // Load all existing relationships from the DB for this guild.
    const existingRels = await loadRelationships(guildId);
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

        const existing = guildRelationships[guildId]?.[memberId];
        const displayName = member.displayName ?? member.user?.username ?? memberId;
        const username = member.user?.username ?? memberId;
        const avatarUrl = member.user?.displayAvatarURL({ forceStatic: true, size: 64 });

        if (!existing) {
            // This is a new user, add them.
            guildRelationships[guildId][memberId] = {
                username,
                displayName,
                avatarUrl,
                attitude: defaultRel.attitude,
                behavior: Array.isArray(defaultRel.behavior) ? [...defaultRel.behavior] : [],
                boundaries: Array.isArray(defaultRel.boundaries) ? [...defaultRel.boundaries] : [],
                ignored: false
            };
            changed = true;
        } else {
            // This is an existing user, just ensure their data is up-to-date.
            if (existing.username !== username || existing.displayName !== displayName || existing.avatarUrl !== avatarUrl) {
                existing.username = username;
                existing.displayName = displayName;
                existing.avatarUrl = avatarUrl;
                changed = true;
            }
        }
    }

    // Remove stale relationships (users who left the guild)
    for (const userId of staleUsers) {
        delete guildRelationships[guildId][userId];
        changed = true;
    }

    if (changed) {
        await saveRelationships(guildId, guildRelationships[guildId]);
    }
}

/**
 * Expose function to get all relationships for inspection
 */
export function getAllRelationships() {
    return guildRelationships
}
