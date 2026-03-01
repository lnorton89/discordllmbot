/**
 * Persistence Module
 * 
 * Database persistence layer for messages, relationships, guilds, and configuration.
 * Provides caching wrappers and SQL query logging.
 * 
 * @module shared/storage/persistence
 */

import { getPool } from './database.js';
import { isSqlLoggingEnabled } from '../config/configLoader.js';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

const sqlLogEmitter = new EventEmitter();
let isPoolWrapped = false;

/**
 * Gets the SQL log emitter for real-time query logging.
 * @returns {EventEmitter} The event emitter for SQL logs
 */
export function getSqlLogEmitter() {
    return sqlLogEmitter;
}

/**
 * Resets the pool wrapper flag to re-enable SQL logging wrapper.
 */
export function resetPoolWrapper() {
    isPoolWrapped = false;
}

/**
 * Gets the database pool, optionally wrapped with query logging.
 * @returns {Promise<object>} The database pool
 */
export async function getDb() {
    const pool = await getPool();
    
    if (isPoolWrapped) {
        return pool;
    }
    
    const shouldLog = isSqlLoggingEnabled();
    
    if (!shouldLog) {
        isPoolWrapped = true;
        return pool;
    }
    
    const originalQuery = pool.query.bind(pool);
    
    pool.query = async (...args) => {
        const startTime = Date.now();
        const query = typeof args[0] === 'string' ? args[0] : args[0].text;
        const params = args[0].params || args[1];
        
        try {
            const result = await originalQuery(...args);
            const duration = Date.now() - startTime;
            
            const logEntry = `${query.substring(0, 100)}${query.length > 100 ? '...' : ''} (${duration}ms)`;
            logger.sql(logEntry, { query, params, duration });
            sqlLogEmitter.emit('query', logEntry, { query, params, duration });
            
            return result;
        } catch (err) {
            const duration = Date.now() - startTime;
            const logEntry = `${query.substring(0, 100)}${query.length > 100 ? '...' : ''} ERROR (${duration}ms)`;
            logger.sql(logEntry, { query, params, duration, error: err.message });
            sqlLogEmitter.emit('query', logEntry, { query, params, duration, error: err.message });
            throw err;
        }
    };
    
    isPoolWrapped = true;
    return pool;
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

    if (relRes.rows.length === 0) {
        return rels;
    }

    const userIds = relRes.rows.map(r => r.userid);

    const [behaviorRes, boundaryRes] = await Promise.all([
        db.query('SELECT userId, behavior FROM relationship_behaviors WHERE guildId = $1 AND userId = ANY($2)', [guildId, userIds]),
        db.query('SELECT userId, boundary FROM relationship_boundaries WHERE guildId = $1 AND userId = ANY($2)', [guildId, userIds])
    ]);

    const behaviorByUser = {};
    for (const row of behaviorRes.rows) {
        behaviorByUser[row.userid] ??= [];
        behaviorByUser[row.userid].push(row.behavior);
    }

    const boundaryByUser = {};
    for (const row of boundaryRes.rows) {
        boundaryByUser[row.userid] ??= [];
        boundaryByUser[row.userid].push(row.boundary);
    }

    for (const row of relRes.rows) {
        rels[row.userid] = {
            attitude: row.attitude,
            username: row.username,
            displayName: row.displayname,
            avatarUrl: row.avatarurl,
            ignored: row.ignored,
            behavior: behaviorByUser[row.userid] ?? [],
            boundaries: boundaryByUser[row.userid] ?? [],
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
    const result = await db.query(`
        SELECT nickname, speakingStyle, replyProbability, minDelayMs, maxDelayMs, mentionOnly,
               ignoreUsers, ignoreChannels, ignoreKeywords, guildSpecificChannels
        FROM server_configs
        WHERE guildId = $1
    `, [guildId]);

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    return {
        nickname: row.nickname,
        speakingStyle: row.speakingstyle,
        replyBehavior: {
            replyProbability: row.replyprobability,
            minDelayMs: row.mindelayms,
            maxDelayMs: row.maxdelayms,
            mentionOnly: row.mentiononly,
            ignoreUsers: row.ignoreusers,
            ignoreChannels: row.ignorechannels,
            ignoreKeywords: row.ignorekeywords,
            guildSpecificChannels: row.guildspecificchannels,
        },
    };
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
        INSERT INTO server_configs (
            guildId, nickname, speakingStyle, replyProbability, minDelayMs, maxDelayMs,
            mentionOnly, ignoreUsers, ignoreChannels, ignoreKeywords, guildSpecificChannels, updatedAt
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        ON CONFLICT (guildId)
        DO UPDATE SET
            nickname = $2,
            speakingStyle = $3,
            replyProbability = $4,
            minDelayMs = $5,
            maxDelayMs = $6,
            mentionOnly = $7,
            ignoreUsers = $8,
            ignoreChannels = $9,
            ignoreKeywords = $10,
            guildSpecificChannels = $11,
            updatedAt = CURRENT_TIMESTAMP
    `, [
        guildId,
        config.nickname ?? null,
        JSON.stringify(config.speakingStyle),
        config.replyBehavior.replyProbability,
        config.replyBehavior.minDelayMs,
        config.replyBehavior.maxDelayMs,
        config.replyBehavior.mentionOnly,
        JSON.stringify(config.replyBehavior.ignoreUsers ?? []),
        JSON.stringify(config.replyBehavior.ignoreChannels ?? []),
        JSON.stringify(config.replyBehavior.ignoreKeywords ?? []),
        JSON.stringify(config.replyBehavior.guildSpecificChannels ?? {}),
    ]);
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
    const result = await db.query(`
        SELECT botUsername, botDescription, botGlobalRules,
               llmProvider, llmGeminiModel, llmOllamaModel, llmQwenModel,
               llmGeminiApiKey, llmOllamaApiKey, llmQwenApiKey,
               llmRetryAttempts, llmRetryBackoffMs,
               memoryMaxMessages, memoryMaxMessageAgeDays,
               loggerMaxLogLines, loggerLogReplyDecisions, loggerLogSql,
               sandboxEnabled, sandboxTimeoutMs, sandboxAllowedCommands
        FROM global_config
        WHERE id = $1
    `, ['global']);

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    return {
        botPersona: {
            username: row.botusername,
            description: row.botdescription,
            globalRules: row.botglobalrules,
        },
        llm: {
            provider: row.llmprovider,
            geminiModel: row.llmgeminimodel,
            ollamaModel: row.llmollamamodel,
            qwenModel: row.llmqwenmodel,
            geminiApiKey: row.llmgeminiapikey,
            ollamaApiKey: row.llmollamaapikey,
            qwenApiKey: row.llmqwenapikey,
            retryAttempts: row.llmretryattempts,
            retryBackoffMs: row.llmretrybackoffms,
        },
        memory: {
            maxMessages: row.memorymaxmessages,
            maxMessageAgeDays: row.memorymaxmessageagedays,
        },
        logger: {
            maxLogLines: row.loggermaxloglines,
            logReplyDecisions: row.loggerlogreplydecisions,
            logSql: row.loggerlogsql,
        },
        sandbox: {
            enabled: row.sandboxenabled ?? false,
            timeoutMs: row.sandboxtimeoutms ?? 30000,
            allowedCommands: row.sandboxallowedcommands ?? ['ps', 'stats', 'images', 'top', 'logs', 'inspect', 'version', 'info'],
        },
    };
}

/**
 * Saves global configuration
 * @param {Object} config - The global configuration
 * @returns {Promise<void>}
 */
export async function saveGlobalConfig(config) {
    const db = await getDb();

    const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || config.llm.geminiApiKey || null;
    const ollamaApiKey = process.env.OLLAMA_API_KEY?.trim() || config.llm.ollamaApiKey || null;
    const qwenApiKey = process.env.QWEN_API_KEY?.trim() || config.llm.qwenApiKey || null;

    await db.query(`
        INSERT INTO global_config (
            id, botUsername, botDescription, botGlobalRules,
            llmProvider, llmGeminiModel, llmOllamaModel, llmQwenModel,
            llmGeminiApiKey, llmOllamaApiKey, llmQwenApiKey,
            llmRetryAttempts, llmRetryBackoffMs,
            memoryMaxMessages, memoryMaxMessageAgeDays,
            loggerMaxLogLines, loggerLogReplyDecisions, loggerLogSql,
            sandboxEnabled, sandboxTimeoutMs, sandboxAllowedCommands,
            updatedAt
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
        ON CONFLICT (id)
        DO UPDATE SET
            botUsername = $2,
            botDescription = $3,
            botGlobalRules = $4,
            llmProvider = $5,
            llmGeminiModel = $6,
            llmOllamaModel = $7,
            llmQwenModel = $8,
            llmGeminiApiKey = $9,
            llmOllamaApiKey = $10,
            llmQwenApiKey = $11,
            llmRetryAttempts = $12,
            llmRetryBackoffMs = $13,
            memoryMaxMessages = $14,
            memoryMaxMessageAgeDays = $15,
            loggerMaxLogLines = $16,
            loggerLogReplyDecisions = $17,
            loggerLogSql = $18,
            sandboxEnabled = $19,
            sandboxTimeoutMs = $20,
            sandboxAllowedCommands = $21,
            updatedAt = CURRENT_TIMESTAMP
    `, [
        'global',
        config.botPersona.username,
        config.botPersona.description,
        JSON.stringify(config.botPersona.globalRules),
        config.llm.provider,
        config.llm.geminiModel,
        config.llm.ollamaModel,
        config.llm.qwenModel,
        geminiApiKey,
        ollamaApiKey,
        qwenApiKey,
        config.llm.retryAttempts,
        config.llm.retryBackoffMs,
        config.memory.maxMessages,
        config.memory.maxMessageAgeDays,
        config.logger.maxLogLines,
        config.logger.logReplyDecisions,
        config.logger.logSql,
        config.sandbox.enabled,
        config.sandbox.timeoutMs,
        JSON.stringify(config.sandbox.allowedCommands),
    ]);
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
        SELECT sc.guildId,
               jsonb_build_object(
                   'nickname', sc.nickname,
                   'speakingStyle', sc.speakingStyle,
                   'replyBehavior', jsonb_build_object(
                       'replyProbability', sc.replyProbability,
                       'minDelayMs', sc.minDelayMs,
                       'maxDelayMs', sc.maxDelayMs,
                       'mentionOnly', sc.mentionOnly,
                       'ignoreUsers', sc.ignoreUsers,
                       'ignoreChannels', sc.ignoreChannels,
                       'ignoreKeywords', sc.ignoreKeywords,
                       'guildSpecificChannels', sc.guildSpecificChannels
                   )
               ) AS config,
               g.guildName, sc.updatedAt
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

export async function logAnalyticsEvent(eventType, guildId, channelId, userId, metadata = {}) {
    const db = await getDb();
    await db.query(
        'INSERT INTO analytics_events (eventType, guildId, channelId, userId, metadata) VALUES ($1, $2, $3, $4, $5)',
        [eventType, guildId, channelId, userId, JSON.stringify(metadata)]
    );
}

export async function getAnalyticsOverview(days = 7) {
    const db = await getDb();

    const stats = await db.query(`
        SELECT 
            COUNT(*) FILTER (WHERE eventType = 'reply_sent') as total_replies,
            COUNT(*) FILTER (WHERE eventType = 'reply_declined') as total_declined,
            COUNT(*) FILTER (WHERE eventType = 'message_received') as total_messages,
            COUNT(DISTINCT guildId) FILTER (WHERE eventType = 'reply_sent') as active_servers,
            COUNT(DISTINCT userId) FILTER (WHERE eventType = 'message_received') as active_users,
            ROUND(AVG((metadata->>'latencyMs')::numeric)) as avg_latency,
            SUM((metadata->>'promptTokens')::int) as total_prompt_tokens,
            SUM((metadata->>'responseTokens')::int) as total_response_tokens,
            COUNT(*) FILTER (WHERE eventType = 'llm_error') as total_errors
        FROM analytics_events 
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
    `, [days]);

    const replyRate = await db.query(`
        SELECT 
            CASE 
                WHEN COUNT(*) FILTER (WHERE eventType = 'message_received') > 0
                THEN ROUND(100.0 * COUNT(*) FILTER (WHERE eventType = 'reply_sent') / COUNT(*) FILTER (WHERE eventType = 'message_received'), 2)
                ELSE 0
            END as reply_rate
        FROM analytics_events
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
    `, [days]);

    const errorRate = await db.query(`
        SELECT 
            CASE 
                WHEN COUNT(*) FILTER (WHERE eventType = 'llm_call') > 0
                THEN ROUND(100.0 * COUNT(*) FILTER (WHERE eventType = 'llm_error') / COUNT(*) FILTER (WHERE eventType = 'llm_call'), 2)
                ELSE 0
            END as error_rate
        FROM analytics_events
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
    `, [days]);

    return {
        stats: stats.rows[0],
        replyRate: replyRate.rows[0]?.reply_rate || 0,
        errorRate: errorRate.rows[0]?.error_rate || 0
    };
}

export async function getAnalyticsVolume(days = 7) {
    const db = await getDb();

    const daily = await db.query(`
        SELECT 
            DATE(timestamp) as date,
            COUNT(*) FILTER (WHERE eventType = 'message_received') as messages,
            COUNT(*) FILTER (WHERE eventType = 'reply_attempt') as reply_attempts,
            COUNT(*) FILTER (WHERE eventType = 'reply_sent') as replies_sent,
            COUNT(*) FILTER (WHERE eventType = 'reply_declined') as replies_declined
        FROM analytics_events
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
    `, [days]);

    const hourly = await db.query(`
        SELECT 
            EXTRACT(HOUR FROM timestamp) as hour,
            COUNT(*) FILTER (WHERE eventType = 'message_received') as messages,
            COUNT(*) FILTER (WHERE eventType = 'reply_sent') as replies
        FROM analytics_events
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY hour
    `, [days]);

    return { daily: daily.rows, hourly: hourly.rows };
}

export async function getAnalyticsDecisions(days = 7) {
    const db = await getDb();

    logger.info(`getAnalyticsDecisions: querying for ${days} days`);

    const totalEvents = await db.query(`
        SELECT COUNT(*) as total FROM analytics_events 
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
    `, [days]);
    logger.info(`getAnalyticsDecisions: total events in range = ${totalEvents.rows[0].total}`);

    const eventTypeCounts = await db.query(`
        SELECT eventType, COUNT(*) as count FROM analytics_events
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY eventType
    `, [days]);
    logger.info(`getAnalyticsDecisions: event type counts = ${JSON.stringify(eventTypeCounts.rows)}`);

    const breakdown = await db.query(`
        SELECT 
            metadata->>'reason' as reason,
            COUNT(*) as count
        FROM analytics_events
        WHERE eventType = 'reply_declined' 
            AND timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY metadata->>'reason'
        ORDER BY count DESC
    `, [days]);
    logger.info(`getAnalyticsDecisions: breakdown query returned ${breakdown.rows.length} rows`);

    const funnel = await db.query(`
        SELECT 
            COUNT(*) FILTER (WHERE eventType = 'message_received') as messages_received,
            COUNT(*) FILTER (WHERE (metadata->>'isMentioned')::boolean = true) as messages_mentioned,
            COUNT(*) FILTER (WHERE eventType = 'reply_attempt') as reply_attempts,
            COUNT(*) FILTER (WHERE eventType = 'reply_sent') as replies_sent
        FROM analytics_events
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
    `, [days]);
    logger.info(`getAnalyticsDecisions: funnel = ${JSON.stringify(funnel.rows[0])}`);

    return { 
        breakdown: breakdown.rows.map(r => ({ reason: r.reason, count: parseInt(r.count) })), 
        funnel: funnel.rows[0] 
    };
}

export async function getAnalyticsProviders(days = 7) {
    const db = await getDb();

    const byProvider = await db.query(`
        SELECT 
            metadata->>'provider' as provider,
            metadata->>'model' as model,
            COUNT(*) as call_count,
            ROUND(AVG((metadata->>'latencyMs')::numeric)) as avg_latency,
            SUM((metadata->>'promptTokens')::int) as prompt_tokens,
            SUM((metadata->>'responseTokens')::int) as response_tokens,
            COUNT(*) FILTER (WHERE eventType = 'llm_error') as error_count
        FROM analytics_events
        WHERE eventType = 'llm_call' AND timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY metadata->>'provider', metadata->>'model'
        ORDER BY call_count DESC
    `, [days]);

    const errorTypes = await db.query(`
        SELECT 
            metadata->>'errorType' as error_type,
            metadata->>'provider' as provider,
            COUNT(*) as count
        FROM analytics_events
        WHERE eventType = 'llm_error' AND timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY metadata->>'errorType', metadata->>'provider'
        ORDER BY count DESC
    `, [days]);

    return { byProvider: byProvider.rows, errorTypes: errorTypes.rows };
}

export async function getAnalyticsPerformance(days = 7) {
    const db = await getDb();

    const latencyTrend = await db.query(`
        SELECT 
            DATE(timestamp) as date,
            ROUND(AVG((metadata->>'latencyMs')::numeric)) as avg_latency,
            MIN((metadata->>'latencyMs')::numeric) as min_latency,
            MAX((metadata->>'latencyMs')::numeric) as max_latency,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (metadata->>'latencyMs')::numeric) as p50_latency,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (metadata->>'latencyMs')::numeric) as p95_latency
        FROM analytics_events
        WHERE eventType = 'llm_call' AND metadata->>'latencyMs' IS NOT NULL
            AND timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
    `, [days]);

    const tokenTrend = await db.query(`
        SELECT 
            DATE(timestamp) as date,
            SUM((metadata->>'promptTokens')::int) as prompt_tokens,
            SUM((metadata->>'responseTokens')::int) as response_tokens,
            COUNT(*) as call_count
        FROM analytics_events
        WHERE eventType = 'llm_call' AND timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
    `, [days]);

    return { latencyTrend: latencyTrend.rows, tokenTrend: tokenTrend.rows };
}

export async function getAnalyticsUsers(days = 7, guildId = null, limit = 20) {
    const db = await getDb();

    const guildIdValue = guildId && guildId.trim() ? guildId.trim() : null;
    
    let topUsers;
    let userDistribution;
    
    if (guildIdValue) {
        topUsers = await db.query(`
            SELECT 
                userId,
                metadata->>'username' as username,
                COUNT(*) FILTER (WHERE eventType = 'message_received') as messages_sent,
                COUNT(*) FILTER (WHERE eventType = 'reply_sent') as replies_received,
                COUNT(DISTINCT channelId) as channels_used,
                MIN(timestamp) as first_seen,
                MAX(timestamp) as last_seen
            FROM analytics_events
            WHERE eventType IN ('message_received', 'reply_sent')
                AND guildId = $2
                AND timestamp > NOW() - INTERVAL '1 day' * $1
            GROUP BY userId, metadata->>'username'
            ORDER BY messages_sent DESC
            LIMIT $3
        `, [days, guildIdValue, limit]);

        userDistribution = await db.query(`
            SELECT 
                CASE 
                    WHEN cnt <= 5 THEN '1-5'
                    WHEN cnt <= 10 THEN '6-10'
                    WHEN cnt <= 20 THEN '11-20'
                    WHEN cnt <= 50 THEN '21-50'
                    ELSE '50+'
                END as message_range,
                COUNT(*) as user_count
            FROM (
                SELECT userId, COUNT(*) as cnt
                FROM analytics_events
                WHERE eventType = 'message_received'
                    AND guildId = $2
                    AND timestamp > NOW() - INTERVAL '1 day' * $1
                GROUP BY userId
            ) sub
            GROUP BY 
                CASE 
                    WHEN cnt <= 5 THEN '1-5'
                    WHEN cnt <= 10 THEN '6-10'
                    WHEN cnt <= 20 THEN '11-20'
                    WHEN cnt <= 50 THEN '21-50'
                    ELSE '50+'
                END
            ORDER BY 
                CASE 
                    WHEN (CASE WHEN cnt <= 5 THEN '1-5' WHEN cnt <= 10 THEN '6-10' WHEN cnt <= 20 THEN '11-20' WHEN cnt <= 50 THEN '21-50' ELSE '50+' END) = '1-5' THEN 1
                    WHEN (CASE WHEN cnt <= 5 THEN '1-5' WHEN cnt <= 10 THEN '6-10' WHEN cnt <= 20 THEN '11-20' WHEN cnt <= 50 THEN '21-50' ELSE '50+' END) = '6-10' THEN 2
                    WHEN (CASE WHEN cnt <= 5 THEN '1-5' WHEN cnt <= 10 THEN '6-10' WHEN cnt <= 20 THEN '11-20' WHEN cnt <= 50 THEN '21-50' ELSE '50+' END) = '11-20' THEN 3
                    WHEN (CASE WHEN cnt <= 5 THEN '1-5' WHEN cnt <= 10 THEN '6-10' WHEN cnt <= 20 THEN '11-20' WHEN cnt <= 50 THEN '21-50' ELSE '50+' END) = '21-50' THEN 4
                    ELSE 5
                END
        `, [days, guildIdValue]);
    } else {
        topUsers = await db.query(`
            SELECT 
                userId,
                metadata->>'username' as username,
                COUNT(*) FILTER (WHERE eventType = 'message_received') as messages_sent,
                COUNT(*) FILTER (WHERE eventType = 'reply_sent') as replies_received,
                COUNT(DISTINCT channelId) as channels_used,
                MIN(timestamp) as first_seen,
                MAX(timestamp) as last_seen
            FROM analytics_events
            WHERE eventType IN ('message_received', 'reply_sent')
                AND timestamp > NOW() - INTERVAL '1 day' * $1
            GROUP BY userId, metadata->>'username'
            ORDER BY messages_sent DESC
            LIMIT $2
        `, [days, limit]);

        userDistribution = await db.query(`
            SELECT 
                CASE 
                    WHEN cnt <= 5 THEN '1-5'
                    WHEN cnt <= 10 THEN '6-10'
                    WHEN cnt <= 20 THEN '11-20'
                    WHEN cnt <= 50 THEN '21-50'
                    ELSE '50+'
                END as message_range,
                COUNT(*) as user_count
            FROM (
                SELECT userId, COUNT(*) as cnt
                FROM analytics_events
                WHERE eventType = 'message_received'
                    AND timestamp > NOW() - INTERVAL '1 day' * $1
                GROUP BY userId
            ) sub
            GROUP BY 
                CASE 
                    WHEN cnt <= 5 THEN '1-5'
                    WHEN cnt <= 10 THEN '6-10'
                    WHEN cnt <= 20 THEN '11-20'
                    WHEN cnt <= 50 THEN '21-50'
                    ELSE '50+'
                END
            ORDER BY 
                CASE 
                    WHEN (CASE WHEN cnt <= 5 THEN '1-5' WHEN cnt <= 10 THEN '6-10' WHEN cnt <= 20 THEN '11-20' WHEN cnt <= 50 THEN '21-50' ELSE '50+' END) = '1-5' THEN 1
                    WHEN (CASE WHEN cnt <= 5 THEN '1-5' WHEN cnt <= 10 THEN '6-10' WHEN cnt <= 20 THEN '11-20' WHEN cnt <= 50 THEN '21-50' ELSE '50+' END) = '6-10' THEN 2
                    WHEN (CASE WHEN cnt <= 5 THEN '1-5' WHEN cnt <= 10 THEN '6-10' WHEN cnt <= 20 THEN '11-20' WHEN cnt <= 50 THEN '21-50' ELSE '50+' END) = '11-20' THEN 3
                    WHEN (CASE WHEN cnt <= 5 THEN '1-5' WHEN cnt <= 10 THEN '6-10' WHEN cnt <= 20 THEN '11-20' WHEN cnt <= 50 THEN '21-50' ELSE '50+' END) = '21-50' THEN 4
                    ELSE 5
                END
        `, [days]);
    }

    return { topUsers: topUsers.rows, userDistribution: userDistribution.rows };
}

export async function getAnalyticsChannels(days = 7, guildId = null) {
    const db = await getDb();

    const guildIdValue = guildId && guildId.trim() ? guildId.trim() : null;

    let channelActivity;
    
    if (guildIdValue) {
        channelActivity = await db.query(`
            SELECT 
                channelId,
                metadata->>'channelName' as channel_name,
                COUNT(*) FILTER (WHERE eventType = 'message_received') as messages,
                COUNT(*) FILTER (WHERE eventType = 'reply_sent') as replies,
                COUNT(DISTINCT userId) as unique_users
            FROM analytics_events
            WHERE eventType IN ('message_received', 'reply_sent')
                AND guildId = $2
                AND timestamp > NOW() - INTERVAL '1 day' * $1
            GROUP BY channelId, metadata->>'channelName'
            ORDER BY messages DESC
            LIMIT 20
        `, [days, guildIdValue]);
    } else {
        channelActivity = await db.query(`
            SELECT 
                channelId,
                metadata->>'channelName' as channel_name,
                COUNT(*) FILTER (WHERE eventType = 'message_received') as messages,
                COUNT(*) FILTER (WHERE eventType = 'reply_sent') as replies,
                COUNT(DISTINCT userId) as unique_users
            FROM analytics_events
            WHERE eventType IN ('message_received', 'reply_sent')
                AND timestamp > NOW() - INTERVAL '1 day' * $1
            GROUP BY channelId, metadata->>'channelName'
            ORDER BY messages DESC
            LIMIT 20
        `, [days]);
    }

    return { channelActivity: channelActivity.rows };
}

export async function getAnalyticsErrors(days = 7, limit = 50) {
    const db = await getDb();

    const errors = await db.query(`
        SELECT 
            eventType,
            metadata->>'provider' as provider,
            metadata->>'model' as model,
            metadata->>'errorType' as error_type,
            metadata->>'statusCode' as status_code,
            metadata->>'message' as message,
            timestamp,
            guildId,
            userId
        FROM analytics_events
        WHERE eventType IN ('llm_error', 'reply_error') 
            AND timestamp > NOW() - INTERVAL '1 day' * $1
        ORDER BY timestamp DESC
        LIMIT $1
    `, [limit]);

    return { errors: errors.rows };
}
