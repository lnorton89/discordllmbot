import { connect, setupSchema } from './database.js';

let db;
let schemaSetupComplete = false;
let schemaSetupPromise = null;

async function getDb() {
    if (!db) {
        db = await connect();
    }

    if (!schemaSetupComplete) {
        if (!schemaSetupPromise) {
            schemaSetupPromise = setupSchema().then(() => {
                schemaSetupComplete = true;
            });
        }
        await schemaSetupPromise;
    }
    return db;
}

/**
 * Loads all user relationships for a specific guild.
 *
 * @param {string} guildId - The ID of the guild.
 * @returns {Promise<Object>} A map of user IDs to relationship objects.
 */
export async function loadRelationships(guildId) {
    const db = await getDb();
    const rels = {};

    const relRes = await db.query('SELECT userId, attitude, username, displayName, ignored, avatarUrl FROM relationships WHERE guildId = $1', [guildId]);

    for (const row of relRes.rows) {
        const behaviorRes = await db.query('SELECT behavior FROM relationship_behaviors WHERE guildId = $1 AND userId = $2', [guildId, row.userId]);
        const boundaryRes = await db.query('SELECT boundary FROM relationship_boundaries WHERE guildId = $1 AND userId = $2', [guildId, row.userId]);

        rels[row.userid] = {
            attitude: row.attitude,
            username: row.username,
            displayName: row.displayname,
            avatarUrl: row.avatarurl,
            ignored: row.ignored,
            behavior: behaviorRes.rows.map(r => r.behavior),
            boundaries: boundaryRes.rows.map(r => r.boundary),
        };
    }
    return rels;
}

/**
 * Saves all user relationships for a specific guild.
 * Uses a transaction to ensure data integrity.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {Object} relationships - A map of user IDs to relationship objects.
 * @returns {Promise<void>}
 */
export async function saveRelationships(guildId, relationships) {
    const db = await getDb();
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM relationship_behaviors WHERE guildId = $1', [guildId]);
        await client.query('DELETE FROM relationship_boundaries WHERE guildId = $1', [guildId]);
        await client.query('DELETE FROM relationships WHERE guildId = $1', [guildId]);

        for (const userId in relationships) {
            const rel = relationships[userId];
            await client.query('INSERT INTO relationships (guildId, userId, attitude, username, displayName, ignored, avatarUrl) VALUES ($1, $2, $3, $4, $5, $6, $7)', [guildId, userId, rel.attitude, rel.username, rel.displayName, rel.ignored ?? false, rel.avatarUrl]);
            for (const b of rel.behavior) {
                await client.query('INSERT INTO relationship_behaviors (guildId, userId, behavior) VALUES ($1, $2, $3)', [guildId, userId, b]);
            }
            for (const b of rel.boundaries) {
                await client.query('INSERT INTO relationship_boundaries (guildId, userId, boundary) VALUES ($1, $2, $3)', [guildId, userId, b]);
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

/**
 * Gets server-specific configuration
 * @param {string} guildId - The guild ID
 * @returns {Promise<Object|null>} Server config or null if not found
 */
export async function getServerConfig(guildId) {
    const db = await getDb();
    const result = await db.query('SELECT config FROM server_configs WHERE guildId = $1', [guildId]);
    return result.rows.length > 0 ? result.rows[0].config : null;
}

/**
 * Saves server-specific configuration
 * @param {string} guildId - The guild ID
 * @param {Object} config - The server configuration
 * @returns {Promise<void>}
 */
export async function saveServerConfig(guildId, config) {
    const db = await getDb();
    await db.query(`
        INSERT INTO server_configs (guildId, config, updatedAt)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (guildId)
        DO UPDATE SET config = $2, updatedAt = CURRENT_TIMESTAMP
    `, [guildId, config]);
}

/**
 * Deletes server-specific configuration
 * @param {string} guildId - The guild ID
 * @returns {Promise<void>}
 */
export async function deleteServerConfig(guildId) {
    const db = await getDb();
    await db.query('DELETE FROM server_configs WHERE guildId = $1', [guildId]);
}

/**
 * Gets global configuration
 * @returns {Promise<Object|null>} Global config or null if not found
 */
export async function getGlobalConfig() {
    const db = await getDb();
    const result = await db.query('SELECT config FROM global_config WHERE id = $1', ['global']);
    return result.rows.length > 0 ? result.rows[0].config : null;
}

/**
 * Saves global configuration
 * @param {Object} config - The global configuration
 * @returns {Promise<void>}
 */
export async function saveGlobalConfig(config) {
    const db = await getDb();
    await db.query(`
        INSERT INTO global_config (id, config, updatedAt)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (id)
        DO UPDATE SET config = $2, updatedAt = CURRENT_TIMESTAMP
    `, ['global', config]);
}

/**
 * Deletes global configuration (resets to default)
 * @returns {Promise<void>}
 */
export async function deleteGlobalConfig() {
    const db = await getDb();
    await db.query('DELETE FROM global_config WHERE id = $1', ['global']);
}

/**
 * Gets all server configurations
 * @returns {Promise<Array>} Array of server configs
 */
export async function getAllServerConfigs() {
    const db = await getDb();
    const result = await db.query(`
        SELECT sc.guildId, sc.config, g.guildName, sc.updatedAt
        FROM server_configs sc
        JOIN guilds g ON sc.guildId = g.guildId
        ORDER BY sc.updatedAt DESC
    `);
    return result.rows;
}

/**
 * Loads the recent message history for a specific channel.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} channelId - The ID of the channel.
 * @param {number} maxMessages - The maximum number of messages to retrieve.
 * @returns {Promise<Array<Object>>} An array of message objects.
 */
export async function loadContexts(guildId, channelId, maxMessages) {
    const db = await getDb();
    const res = await db.query(
        'SELECT authorId, authorName, content FROM messages WHERE guildId = $1 AND channelId = $2 ORDER BY timestamp DESC LIMIT $3',
        [guildId, channelId, maxMessages]
    );
    return res.rows.reverse().map(row => ({ authorId: row.authorid, author: row.authorname, content: row.content }));
}

/**
 * Saves a new message to the database.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} channelId - The ID of the channel.
 * @param {string} authorId - The ID of the message author.
 * @param {string} authorName - The username of the message author.
 * @param {string} content - The content of the message.
 * @returns {Promise<void>}
 */
export async function saveMessage(guildId, channelId, authorId, authorName, content) {
    const db = await getDb();
    await db.query(
        'INSERT INTO messages (guildId, channelId, authorId, authorName, content) VALUES ($1, $2, $3, $4, $5)',
        [guildId, channelId, authorId, authorName, content]
    );
}

/**
 * Saves or updates a guild's information.
 *
 * @param {string} guildId - The ID of the guild.
 * @param {string} guildName - The name of the guild.
 * @returns {Promise<void>}
 */
export async function saveGuild(guildId, guildName) {
    const db = await getDb();
    await db.query(
        'INSERT INTO guilds (guildId, guildName) VALUES ($1, $2) ON CONFLICT (guildId) DO UPDATE SET guildName = EXCLUDED.guildName',
        [guildId, guildName]
    );
}

/**
 * Prunes messages older than a specified number of days.
 *
 * @param {number} maxAgeDays - The maximum age of messages in days.
 * @returns {Promise<void>}
 */
export async function pruneOldMessages(maxAgeDays) {
    const db = await getDb();
    await db.query("DELETE FROM messages WHERE timestamp < NOW() - INTERVAL '1 day' * $1", [maxAgeDays]);
}

export async function logBotReply(guildId, channelId, userId, username, displayName, avatarUrl, userMessage, botReply, processingTimeMs, promptTokens, responseTokens) {
    const db = await getDb();
    await db.query(
        'INSERT INTO bot_replies (guildId, channelId, userId, username, displayName, avatarUrl, userMessage, botReply, processingTimeMs, promptTokens, responseTokens) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [guildId, channelId, userId, username, displayName, avatarUrl, userMessage, botReply, processingTimeMs, promptTokens, responseTokens]
    );
}

export async function getLatestReplies(limit = 10) {
    const db = await getDb();
    const result = await db.query(
        `SELECT r.*, g.guildName 
         FROM bot_replies r 
         JOIN guilds g ON r.guildId = g.guildId 
         ORDER BY r.timestamp DESC 
         LIMIT $1`,
        [limit]
    );
    return result.rows;
}

/**
 * Gathers analytics data for the dashboard.
 *
 * @returns {Promise<Object>} An object containing various analytics data.
 */
export async function getAnalyticsData() {
    const db = await getDb();

    // Stats for the last 24 hours
    const stats24h = await db.query(`
        SELECT 
            COUNT(*) as total_replies,
            COUNT(DISTINCT guildId) as active_servers,
            COUNT(DISTINCT userId) as active_users,
            ROUND(AVG(processingTimeMs)) as avg_processing_time,
            SUM(COALESCE(promptTokens, 0) + COALESCE(responseTokens, 0)) as total_tokens
        FROM bot_replies 
        WHERE timestamp > NOW() - INTERVAL '24 hours'
    `);

    // Volume over time (last 7 days by day)
    const volume = await db.query(`
        SELECT 
            TO_CHAR(timestamp, 'YYYY-MM-DD') as date,
            COUNT(*) as count
        FROM bot_replies
        WHERE timestamp > NOW() - INTERVAL '7 days'
        GROUP BY TO_CHAR(timestamp, 'YYYY-MM-DD')
        ORDER BY date ASC
    `);

    // Top servers (all time)
    const topServers = await db.query(`
        SELECT g.guildName, COUNT(*) as reply_count
        FROM bot_replies r
        JOIN guilds g ON r.guildId = g.guildId
        GROUP BY g.guildName
        ORDER BY reply_count DESC
        LIMIT 5
    `);

    return {
        stats24h: stats24h.rows[0],
        volume: volume.rows,
        topServers: topServers.rows
    };
}
