/**
 * Hypergraph Persistence Layer
 *
 * CRUD operations for the hypergraph memory system.
 * Handles nodes (entities), hyperedges (memories), and memberships.
 *
 * @module shared/storage/hypergraphPersistence
 */

import { getDb } from './persistence.js';
import { logger } from '../utils/logger.js';

// ==================== Node Operations ====================

/**
 * Find or create a node in the hypergraph
 * @param {string} guildId - Guild ID
 * @param {string} nodeId - Unique identifier within guild
 * @param {string} nodeType - Type of node ('user', 'channel', 'topic', 'emotion', 'event', 'concept')
 * @param {string} name - Display name
 * @param {object} metadata - Additional data
 * @returns {Promise<number>} Node ID
 */
export async function findOrCreateNode(guildId, nodeId, nodeType, name, metadata = {}) {
    const db = await getDb();

    const result = await db.query(
        `INSERT INTO hyper_nodes (guildid, nodeid, nodetype, name, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guildid, nodeid, nodetype)
         DO UPDATE SET
             name = EXCLUDED.name,
             metadata = CASE WHEN EXCLUDED.metadata::text = '{}' THEN hyper_nodes.metadata ELSE EXCLUDED.metadata END,
             updatedat = CURRENT_TIMESTAMP
         RETURNING id`,
        [guildId, nodeId, nodeType, name, JSON.stringify(metadata)]
    );

    return result.rows[0].id;
}

/**
 * Get nodes by type for a guild
 * @param {string} guildId - Guild ID
 * @param {string} nodeType - Node type filter
 * @returns {Promise<Array>} Nodes
 */
export async function getNodesByType(guildId, nodeType) {
    const db = await getDb();
    const result = await db.query(
        `SELECT * FROM hyper_nodes WHERE guildid = $1 AND nodetype = $2 ORDER BY createdat DESC`,
        [guildId, nodeType]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        nodeId: row.nodeid,
        nodeType: row.nodetype,
        name: row.name,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat
    }));
}

/**
 * Get all nodes for a guild with memory counts
 * @param {string} guildId - Guild ID
 * @returns {Promise<Array>} Nodes
 */
export async function getAllNodes(guildId) {
    const db = await getDb();
    const result = await db.query(
        `SELECT n.*, COUNT(hem.hyperedgeid) as memoryCount
         FROM hyper_nodes n
         LEFT JOIN hyperedge_memberships hem ON n.id = hem.nodeid
         WHERE n.guildid = $1
         GROUP BY n.id
         ORDER BY memoryCount DESC, n.name ASC`,
        [guildId]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        nodeId: row.nodeid,
        nodeType: row.nodetype,
        name: row.name,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        memoryCount: row.memorycount
    }));
}

/**
 * Find a node by guild, node ID, and type
 * @param {string} guildId - Guild ID
 * @param {string} nodeId - Node ID
 * @param {string} nodeType - Node type
 * @returns {Promise<object|null>} Node or null
 */
export async function findNode(guildId, nodeId, nodeType) {
    const db = await getDb();
    const result = await db.query(
        `SELECT * FROM hyper_nodes WHERE guildid = $1 AND nodeid = $2 AND nodetype = $3`,
        [guildId, nodeId, nodeType]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        id: row.id,
        guildId: row.guildid,
        nodeId: row.nodeid,
        nodeType: row.nodetype,
        name: row.name,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat
    };
}

// ==================== Hyperedge Operations ====================

/**
 * Create a new hyperedge (memory) with its memberships
 * @param {string} guildId - Guild ID
 * @param {object} edgeData - Edge data
 * @returns {Promise<number>} Hyperedge ID
 */
export async function createHyperedge(guildId, edgeData) {
    const db = await getDb();
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // Create the hyperedge
        const edgeResult = await client.query(
            `INSERT INTO hyperedges (guildid, channelid, edgetype, summary, content, importance, urgency,
                sourcemessageid, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [guildId, edgeData.channelId, edgeData.edgeType, edgeData.summary,
             edgeData.content || null, edgeData.importance || 1.0, edgeData.importance || 1.0,
             edgeData.sourceMessageId || null, JSON.stringify(edgeData.metadata || {})]
        );

        const edgeId = edgeResult.rows[0].id;

        // Create memberships
        for (const membership of edgeData.memberships || []) {
            const nodeId = await findOrCreateNode(
                guildId,
                membership.entity.id,
                membership.entity.type,
                membership.entity.name,
                membership.entity.metadata || {}
            );

            await client.query(
                `INSERT INTO hyperedge_memberships (hyperedgeid, nodeid, role, weight, metadata)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (hyperedgeid, nodeid, role) DO NOTHING`,
                [edgeId, nodeId, membership.role, membership.weight || 1.0,
                 JSON.stringify(membership.metadata || {})]
            );
        }

        await client.query('COMMIT');
        logger.info(`Created hyperedge ${edgeId}: ${edgeData.summary}`);
        return edgeId;
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to create hyperedge', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Query hyperedges by node with urgency threshold
 * @param {string} guildId - Guild ID
 * @param {string} nodeId - Node ID to search for
 * @param {number} minUrgency - Minimum urgency score
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Hyperedges with members
 */
export async function queryMemoriesByNode(guildId, nodeId, minUrgency = 0.1, limit = 20) {
    const db = await getDb();
    const result = await db.query(
        `SELECT e.*,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'nodeId', n.nodeid,
                        'nodeType', n.nodetype,
                        'name', n.name,
                        'role', hem.role,
                        'weight', hem.weight
                    ) ORDER BY hem.weight DESC)
                     FROM hyperedge_memberships hem
                     JOIN hyper_nodes n ON hem.nodeid = n.id
                     WHERE hem.hyperedgeid = e.id),
                    '[]'::json
                ) as members
         FROM hyperedges e
         JOIN hyperedge_memberships m ON e.id = m.hyperedgeid
         JOIN hyper_nodes n_main ON m.nodeid = n_main.id
         WHERE e.guildid = $1
           AND n_main.nodeid = $2
           AND e.urgency >= $3
         GROUP BY e.id
         ORDER BY e.urgency DESC
         LIMIT $4`,
        [guildId, nodeId, minUrgency, limit]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        channelId: row.channelid,
        edgeType: row.edgetype,
        summary: row.summary,
        content: row.content,
        importance: row.importance,
        urgency: row.urgency,
        accessCount: row.accesscount,
        lastAccessedAt: row.lastaccessedat,
        sourceMessageId: row.sourcemessageid,
        extractedAt: row.extractedat,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        members: row.members
    }));
}

/**
 * Get contextual memories for LLM prompt generation
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID to prioritize (optional)
 * @param {number} limit - Max memories to return
 * @returns {Promise<Array>} Relevant memories
 */
export async function getContextualMemories(guildId, channelId, userId, limit = 10) {
    const db = await getDb();
    
    const result = await db.query(
        `SELECT e.*,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'nodeType', n.nodetype,
                        'name', n.name,
                        'role', hem.role
                    ) ORDER BY hem.weight DESC)
                     FROM hyperedge_memberships hem
                     JOIN hyper_nodes n ON hem.nodeid = n.id
                     WHERE hem.hyperedgeid = e.id),
                    '[]'::json
                ) as members,
                EXISTS (
                    SELECT 1 FROM hyperedge_memberships hem2
                    JOIN hyper_nodes n2 ON hem2.nodeid = n2.id
                    WHERE hem2.hyperedgeid = e.id AND n2.nodeid = $3
                ) as involves_user
         FROM hyperedges e
         WHERE e.guildid = $1
           AND e.channelid = $2
           AND e.urgency > 0.1
         ORDER BY involves_user DESC, e.urgency DESC
         LIMIT $4`,
        [guildId, channelId, userId, limit]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        channelId: row.channelid,
        edgeType: row.edgetype,
        summary: row.summary,
        content: row.content,
        importance: row.importance,
        urgency: row.urgency,
        accessCount: row.accesscount,
        lastAccessedAt: row.lastaccessedat,
        sourceMessageId: row.sourcemessageid,
        extractedAt: row.extractedat,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        members: row.members
    }));
}

/**
 * Get user facts that can be shared across channels (edgeType = 'fact')
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {number} limit - Max facts to return
 * @returns {Promise<Array>} User facts
 */
export async function getUserFacts(guildId, userId, limit = 10) {
    const db = await getDb();
    const result = await db.query(
        `SELECT e.*
         FROM hyperedges e
         WHERE e.guildid = $1
           AND e.edgetype = 'fact'
           AND e.urgency > 0.1
           AND EXISTS (
               SELECT 1 FROM hyperedge_memberships hem
               JOIN hyper_nodes n ON hem.nodeid = n.id
               WHERE hem.hyperedgeid = e.id AND n.nodeid = $2
           )
         ORDER BY e.urgency DESC
         LIMIT $3`,
        [guildId, userId, limit]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        channelId: row.channelid,
        edgeType: row.edgetype,
        summary: row.summary,
        content: row.content,
        importance: row.importance,
        urgency: row.urgency,
        accessCount: row.accesscount,
        lastAccessedAt: row.lastaccessedat,
        sourceMessageId: row.sourcemessageid,
        extractedAt: row.extractedat,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat
    }));
}

/**
 * Get global knowledge facts (not tied to specific users)
 * @param {string} guildId - Guild ID
 * @param {number} limit - Max facts to return
 * @returns {Promise<Array>} Global facts
 */
export async function getGlobalKnowledge(guildId, limit = 10) {
    const db = await getDb();
    const result = await db.query(
        `SELECT e.*,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'nodeType', n.nodetype,
                        'name', n.name,
                        'role', hem.role
                    ) ORDER BY hem.weight DESC)
                     FROM hyperedge_memberships hem
                     JOIN hyper_nodes n ON hem.nodeid = n.id
                     WHERE hem.hyperedgeid = e.id),
                    '[]'::json
                ) as members
         FROM hyperedges e
         WHERE e.guildid = $1
           AND e.edgetype = 'fact'
           AND e.urgency > 0.1
           AND e.channelid = 'system-ingestion'
         ORDER BY e.urgency DESC
         LIMIT $2`,
        [guildId, limit]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        channelId: row.channelid,
        edgeType: row.edgetype,
        summary: row.summary,
        content: row.content,
        importance: row.importance,
        urgency: row.urgency,
        accessCount: row.accesscount,
        lastAccessedAt: row.lastaccessedat,
        sourceMessageId: row.sourcemessageid,
        extractedAt: row.extractedat,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        members: row.members
    }));
}

/**
 * Search memories by keyword with entity-awareness and boosted importance scoring
 * @param {string} guildId - Guild ID
 * @param {string[]} keywords - Array of keywords to search for
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Matching memories
 */
export async function searchMemories(guildId, keywords, limit = 10) {
    if (!keywords || keywords.length === 0) return [];
    
    const db = await getDb();
    
    // Construct dynamic ILIKE clauses for keywords
    const textConditions = keywords.map((_, i) => `(e.summary ILIKE $${i + 3} OR e.content ILIKE $${i + 3})`).join(' OR ');
    
    const result = await db.query(
        `SELECT e.*,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'nodeType', n.nodetype,
                        'name', n.name,
                        'role', hem.role
                    ) ORDER BY hem.weight DESC)
                     FROM hyperedge_memberships hem
                     JOIN hyper_nodes n ON hem.nodeid = n.id
                     WHERE hem.hyperedgeid = e.id),
                    '[]'::json
                ) as members
         FROM hyperedges e
         WHERE e.guildid = $1
           AND e.urgency > 0.01
           AND (
               (${textConditions})
               OR EXISTS (
                   SELECT 1 FROM hyperedge_memberships hem_sub
                   JOIN hyper_nodes n_sub ON hem_sub.nodeid = n_sub.id
                   WHERE hem_sub.hyperedgeid = e.id 
                   AND (${keywords.map((_, i) => `n_sub.name ILIKE $${i + 3}`).join(' OR ')})
               )
           )
         -- Score by combined importance and recency/urgency
         ORDER BY (e.importance * 2 + e.urgency) DESC
         LIMIT $2`,
        [guildId, limit, ...keywords.map(k => `%${k}%`)]
    );
    
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        channelId: row.channelid,
        edgeType: row.edgetype,
        summary: row.summary,
        content: row.content,
        importance: row.importance,
        urgency: row.urgency,
        accessCount: row.accesscount,
        lastAccessedAt: row.lastaccessedat,
        sourceMessageId: row.sourcemessageid,
        extractedAt: row.extractedat,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        members: row.members
    }));
}

/**
 * Get graph data for visualization
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID (optional, for filtering)
 * @param {number} limit - Max results
 * @returns {Promise<object>} Graph data with nodes and edges
 */
export async function getGraphData(guildId, channelId = null, limit = 100) {
    const db = await getDb();

    const channelFilter = channelId ? `WHERE e.guildid = $1 AND e.channelid = $2` : `WHERE e.guildid = $1`;
    const params = channelId ? [guildId, channelId, limit] : [guildId, limit];

    // Get edges with memberships
    const edgesResult = await db.query(
        `SELECT e.id, e.edgetype, e.summary, e.urgency, e.channelid,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'nodeId', n.nodeid,
                        'nodeType', n.nodetype,
                        'name', n.name,
                        'role', hem.role,
                        'weight', hem.weight,
                        'id', n.id
                    ))
                     FROM hyperedge_memberships hem
                     JOIN hyper_nodes n ON hem.nodeid = n.id
                     WHERE hem.hyperedgeid = e.id),
                    '[]'::json
                ) as connections
         FROM hyperedges e
         ${channelFilter}
         ORDER BY e.urgency DESC
         LIMIT $${params.length}`,
        params
    );

    // Get unique node IDs from edges
    const nodeInternalIds = new Set();
    edgesResult.rows.forEach(edge => {
        if (edge.connections) {
            edge.connections.forEach(conn => {
                if (conn.id) nodeInternalIds.add(conn.id);
            });
        }
    });

    // Get node details
    let nodes = [];
    if (nodeInternalIds.size > 0) {
        const nodesResult = await db.query(
            `SELECT id, nodeid, nodetype, name, metadata
             FROM hyper_nodes
             WHERE id = ANY($1::int[])
             ORDER BY nodetype, name`,
            [Array.from(nodeInternalIds)]
        );
        nodes = nodesResult.rows.map(row => ({
            id: row.id,
            nodeId: row.nodeid,
            nodeType: row.nodetype,
            name: row.name,
            metadata: row.metadata
        }));
    }

    const edges = edgesResult.rows.map(row => ({
        id: row.id,
        edgeType: row.edgetype,
        summary: row.summary,
        urgency: row.urgency,
        channelId: row.channelid,
        connections: row.connections.map(c => ({
            ...c,
            nodeid: c.id // The frontend expects 'nodeid' referring to the numeric id for linking
        }))
    }));

    return { nodes, edges };
}

// ==================== Decay Operations ====================

/**
 * Update urgency scores for all memories in a guild
 * @param {string} guildId - Guild ID
 * @param {number} decayRate - Daily decay rate
 * @param {number} accessBoost - Boost per access
 * @returns {Promise<Array>} Updated hyperedges
 */
export async function updateMemoryUrgency(guildId, decayRate = 0.1, accessBoost = 0.05) {
    const db = await getDb();
    const result = await db.query(
        `UPDATE hyperedges
         SET urgency = LEAST(importance * EXP(((0.0 - $1::float) * EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - createdat))) / 86400.0) + (accesscount * $2::float), 10.0),
             updatedat = CURRENT_TIMESTAMP
         WHERE guildid = $3
         RETURNING id, urgency, importance`,
        [decayRate, accessBoost, guildId]
    );
    return result.rows;
}

/**
 * Prune low-urgency memories older than threshold
 * @param {string} guildId - Guild ID
 * @param {number} minUrgency - Minimum urgency threshold
 * @param {number} minAgeDays - Minimum age in days before pruning
 * @returns {Promise<number>} Number of pruned memories
 */
export async function pruneLowUrgencyMemories(guildId, minUrgency = 0.1, minAgeDays = 7) {
    const db = await getDb();
    const result = await db.query(
        `DELETE FROM hyperedges
         WHERE guildid = $1
           AND urgency < $2
           AND createdat < NOW() - INTERVAL '1 day' * $3
         RETURNING id`,
        [guildId, minUrgency, minAgeDays]
    );
    logger.info(`Pruned ${result.rowCount} memories from guild ${guildId}`);
    return result.rowCount;
}

/**
 * Record memory access and boost its importance
 * @param {number} hyperedgeId - Hyperedge ID
 * @returns {Promise<void>}
 */
export async function recordMemoryAccess(hyperedgeId) {
    const db = await getDb();
    await db.query(
        `UPDATE hyperedges
         SET accesscount = accesscount + 1,
             lastaccessedat = CURRENT_TIMESTAMP,
             urgency = LEAST(urgency * 1.1, 10.0),
             updatedat = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [hyperedgeId]
    );
}

// ==================== Analytics ====================

/**
 * Get hypergraph statistics for dashboard
 * @param {string} guildId - Guild ID
 * @returns {Promise<object>} Statistics
 */
export async function getHypergraphStats(guildId) {
    const db = await getDb();

    const [nodeStats, edgeStats, topEntities] = await Promise.all([
        db.query(
            `SELECT nodetype, COUNT(*) as count FROM hyper_nodes WHERE guildid = $1 GROUP BY nodetype ORDER BY count DESC`,
            [guildId]
        ),
        db.query(
            `SELECT edgetype, COUNT(*) as count, AVG(urgency) as avgUrgency
             FROM hyperedges WHERE guildid = $1 GROUP BY edgetype ORDER BY count DESC`,
            [guildId]
        ),
        db.query(
            `SELECT n.nodetype, n.name, COUNT(DISTINCT hem.hyperedgeid) as memoryCount
             FROM hyper_nodes n
             JOIN hyperedge_memberships hem ON n.id = hem.nodeid
             JOIN hyperedges e ON hem.hyperedgeid = e.id
             WHERE n.guildid = $1
             GROUP BY n.nodetype, n.name, n.id
             ORDER BY memoryCount DESC
             LIMIT 20`,
            [guildId]
        )
    ]);

    const channelStats = await db.query(
        `SELECT channelid, COUNT(*) as count FROM hyperedges WHERE guildid = $1 GROUP BY channelid ORDER BY count DESC LIMIT 10`,
        [guildId]
    );

    return {
        nodesByType: nodeStats.rows.map(r => ({ nodeType: r.nodetype, count: r.count })),
        edgesByType: edgeStats.rows.map(r => ({ edgeType: r.edgetype, count: r.count, avgUrgency: r.avgurgency })),
        topEntities: topEntities.rows.map(r => ({ nodeType: r.nodetype, name: r.name, memoryCount: r.memorycount })),
        channels: channelStats.rows.map(r => ({ channelId: r.channelid, count: r.count })),
        totalNodes: nodeStats.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
        totalEdges: edgeStats.rows.reduce((sum, r) => sum + parseInt(r.count), 0)
    };
}

/**
 * Get memories for a specific channel (for dashboard)
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID
 * @param {number} minUrgency - Minimum urgency
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Memories
 */
export async function getChannelMemories(guildId, channelId, minUrgency = 0, limit = 50) {
    const db = await getDb();
    const result = await db.query(
        `SELECT e.*,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'nodeType', n.nodetype,
                        'name', n.name,
                        'role', hem.role
                    ) ORDER BY hem.weight DESC)
                     FROM hyperedge_memberships hem
                     JOIN hyper_nodes n ON hem.nodeid = n.id
                     WHERE hem.hyperedgeid = e.id),
                    '[]'::json
                ) as members
         FROM hyperedges e
         WHERE e.guildid = $1 AND e.channelid = $2
           AND e.urgency >= $3
         ORDER BY e.urgency DESC
         LIMIT $4`,
        [guildId, channelId, minUrgency, limit]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        channelId: row.channelid,
        edgeType: row.edgetype,
        summary: row.summary,
        content: row.content,
        importance: row.importance,
        urgency: row.urgency,
        accessCount: row.accesscount,
        lastAccessedAt: row.lastaccessedat,
        sourceMessageId: row.sourcemessageid,
        extractedAt: row.extractedat,
        metadata: row.metadata,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        members: row.members
    }));
}

// ==================== Config Operations ====================

/**
 * Get hypergraph config for a guild
 * @param {string} guildId - Guild ID
 * @returns {Promise<object>} Config
 */
export async function getHypergraphConfig(guildId) {
    const db = await getDb();
    const result = await db.query(
        `SELECT * FROM hypergraph_config WHERE guildid = $1`,
        [guildId]
    );

    if (result.rows.length === 0) {
        return {
            guildId,
            extractionEnabled: true,
            decayRate: 0.1,
            importanceBoostOnAccess: 0.05,
            minUrgencyThreshold: 0.1,
            maxMemoriesPerNode: 100
        };
    }

    const row = result.rows[0];
    return {
        guildId: row.guildid,
        extractionEnabled: row.extractionenabled,
        decayRate: row.decayrate,
        importanceBoostOnAccess: row.importanceboostonaccess,
        minUrgencyThreshold: row.minurgencythreshold,
        maxMemoriesPerNode: row.maxmemoriespernode
    };
}

/**
 * Update hypergraph config for a guild
 * @param {string} guildId - Guild ID
 * @param {object} config - Config values
 * @returns {Promise<void>}
 */
export async function updateHypergraphConfig(guildId, config) {
    const db = await getDb();
    await db.query(
        `INSERT INTO hypergraph_config (guildid, extractionenabled, decayrate,
            importanceboostonaccess, minurgencythreshold, maxmemoriespernode)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (guildid)
         DO UPDATE SET
            extractionenabled = EXCLUDED.extractionenabled,
            decayrate = EXCLUDED.decayrate,
            importanceboostonaccess = EXCLUDED.importanceboostonaccess,
            minurgencythreshold = EXCLUDED.minurgencythreshold,
            maxmemoriespernode = EXCLUDED.maxmemoriespernode,
            updatedat = CURRENT_TIMESTAMP`,
        [guildId,
         config.extractionEnabled !== undefined ? config.extractionEnabled : true,
         config.decayRate !== undefined ? config.decayRate : 0.1,
         config.importanceBoostOnAccess !== undefined ? config.importanceBoostOnAccess : 0.05,
         config.minUrgencyThreshold !== undefined ? config.minUrgencyThreshold : 0.1,
         config.maxMemoriesPerNode !== undefined ? config.maxMemoriesPerNode : 100]
    );
}
