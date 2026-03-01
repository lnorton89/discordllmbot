/**
 * Knowledge Ingestion Persistence Layer
 * Handles RSS feeds and document metadata
 * @module shared/storage/knowledgePersistence
 */

import { getDb } from './persistence.js';
import { logger } from '../utils/logger.js';

// ==================== RSS Feed Operations ====================

export async function createRssFeed(guildId, { url, name, intervalMinutes = 60 }) {
    const db = await getDb();
    const result = await db.query(
        `INSERT INTO rss_feeds (guildId, url, name, intervalMinutes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [guildId, url, name, intervalMinutes]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        guildId: row.guildid,
        url: row.url,
        name: row.name,
        intervalMinutes: row.intervalminutes,
        enabled: row.enabled,
        lastFetchedAt: row.lastfetchedat,
        createdAt: row.createdat,
        updatedAt: row.updatedat
    };
}

export async function getRssFeeds(guildId) {
    const db = await getDb();
    const result = await db.query(
        `SELECT * FROM rss_feeds WHERE guildId = $1 ORDER BY createdAt DESC`,
        [guildId]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        url: row.url,
        name: row.name,
        intervalMinutes: row.intervalminutes,
        enabled: row.enabled,
        lastFetchedAt: row.lastfetchedat,
        createdAt: row.createdat,
        updatedAt: row.updatedat
    }));
}

export async function updateRssFeed(id, { url, name, intervalMinutes, enabled }) {
    const db = await getDb();
    const result = await db.query(
        `UPDATE rss_feeds
         SET url = COALESCE($1, url),
             name = COALESCE($2, name),
             intervalMinutes = COALESCE($3, intervalMinutes),
             enabled = COALESCE($4, enabled),
             updatedAt = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [url, name, intervalMinutes, enabled, id]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        guildId: row.guildid,
        url: row.url,
        name: row.name,
        intervalMinutes: row.intervalminutes,
        enabled: row.enabled,
        lastFetchedAt: row.lastfetchedat,
        createdAt: row.createdat,
        updatedAt: row.updatedat
    };
}

export async function deleteRssFeed(id) {
    const db = await getDb();
    await db.query(`DELETE FROM rss_feeds WHERE id = $1`, [id]);
}

export async function updateRssLastFetched(id) {
    const db = await getDb();
    await db.query(
        `UPDATE rss_feeds SET lastFetchedAt = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
    );
}

// ==================== Document Operations ====================

export async function createIngestedDocument(guildId, { filename, fileType }) {
    const db = await getDb();
    const result = await db.query(
        `INSERT INTO ingested_documents (guildId, filename, fileType, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [guildId, filename, fileType]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        guildId: row.guildid,
        filename: row.filename,
        fileType: row.filetype,
        status: row.status,
        errorMessage: row.errormessage,
        createdAt: row.createdat,
        processedAt: row.processedat
    };
}

export async function updateDocumentStatus(id, { status, errorMessage = null, processedAt = null }) {
    const db = await getDb();
    const result = await db.query(
        `UPDATE ingested_documents
         SET status = $1,
             errorMessage = $2,
             processedAt = CASE WHEN $3 = true THEN CURRENT_TIMESTAMP ELSE processedAt END
         WHERE id = $4
         RETURNING *`,
        [status, errorMessage, processedAt, id]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        guildId: row.guildid,
        filename: row.filename,
        fileType: row.filetype,
        status: row.status,
        errorMessage: row.errormessage,
        createdAt: row.createdat,
        processedAt: row.processedat
    };
}

export async function getIngestedDocuments(guildId) {
    const db = await getDb();
    const result = await db.query(
        `SELECT * FROM ingested_documents WHERE guildId = $1 ORDER BY createdAt DESC`,
        [guildId]
    );
    return result.rows.map(row => ({
        id: row.id,
        guildId: row.guildid,
        filename: row.filename,
        fileType: row.filetype,
        status: row.status,
        errorMessage: row.errormessage,
        createdAt: row.createdat,
        processedAt: row.processedat
    }));
}

export async function deleteIngestedDocument(id) {
    const db = await getDb();
    
    // First get the document details to find associated hyperedges
    const docResult = await db.query('SELECT filename, guildId FROM ingested_documents WHERE id = $1', [id]);
    if (docResult.rows.length === 0) return;
    
    // Database returns lowercased keys by default
    const { filename, guildid } = docResult.rows[0];
    
    // Delete hyperedges associated with this document
    await db.query(
        `DELETE FROM hyperedges 
         WHERE guildId = $1 
           AND metadata->>'source' = 'upload' 
           AND metadata->>'filename' = $2`,
        [guildid, filename]
    );
    
    // Delete the document record
    await db.query(`DELETE FROM ingested_documents WHERE id = $1`, [id]);
    
    logger.info(`Deleted ingested document ${filename} and its hyperedges`);
}