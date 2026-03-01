/**
 * Knowledge Ingestion Module
 * Processes documents and RSS feeds into the hypergraph
 * @module bot/src/core/knowledgeIngestion
 */

import Parser from 'rss-parser';
import * as pdfModule from 'pdf-parse';
import { createHyperedge } from '@shared/storage/hypergraphPersistence.js';

// Handle CommonJS/ESM interop for pdf-parse
let pdf = (pdfModule as any).default || pdfModule;
// If the import is an object but has a PDFParse function property, use that (observed behavior)
if (typeof pdf !== 'function' && typeof (pdf as any).PDFParse === 'function') {
    pdf = (pdf as any).PDFParse;
}
import { 
    getRssFeeds, 
    updateRssLastFetched, 
    updateDocumentStatus 
} from '@shared/storage/knowledgePersistence.js';
import { generateReply } from '@llm/index.js';
import { logger } from '@shared/utils/logger.js';
import { extractKeywords } from '@memory/structuralExtractor.js';

const rssParser = new Parser();

/**
 * Chunks text into smaller pieces for ingestion
 */
function chunkText(text: string, maxLength: number = 1500): string[] {
    const chunks: string[] = [];
    let remaining = text.trim();
    
    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }
        
        // Find a good breaking point (period, newline, or space)
        let breakIndex = remaining.lastIndexOf('\n', maxLength);
        if (breakIndex === -1 || breakIndex < maxLength * 0.5) {
            breakIndex = remaining.lastIndexOf('. ', maxLength);
        }
        if (breakIndex === -1 || breakIndex < maxLength * 0.5) {
            breakIndex = remaining.lastIndexOf(' ', maxLength);
        }
        if (breakIndex === -1) {
            breakIndex = maxLength;
        }
        
        chunks.push(remaining.substring(0, breakIndex).trim());
        remaining = remaining.substring(breakIndex).trim();
    }
    
    return chunks;
}

/**
 * Uses LLM to extract structured knowledge for ingestion
 */
async function extractKnowledge(text: string): Promise<{ summary: string, entities: any[] }> {
    if (!text || text.length < 10) return { summary: 'No content', entities: [] };
    
    try {
        const prompt = `Analyze the following text and extract key knowledge for a hypergraph database.
        Return a JSON object with:
        1. "summary": A concise 1-sentence summary of the main fact.
        2. "entities": An array of objects with "name" and "type" (one of: topic, concept, event, user, channel).
        
        TEXT:
        ${text.substring(0, 3000)}
        
        RESPONSE (JSON ONLY):`;
        
        const response = await generateReply(prompt);
        
        // Clean the response to ensure it's valid JSON
        if (!response.text) {
            throw new Error('LLM returned no content');
        }
        const jsonStr = response.text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonStr);
        
        return {
            summary: data.summary || 'Summary unavailable',
            entities: (data.entities || []).map((e: any) => ({
                id: e.name.toLowerCase().replace(/\s+/g, '-'),
                name: e.name,
                type: e.type || 'topic'
            }))
        };
    } catch (error) {
        logger.warn('Failed to extract structured knowledge via LLM', error);
        return { summary: text.substring(0, 100) + '...', entities: [] };
    }
}

/**
 * Process an RSS feed and ingest new items
 */
export async function processRssFeed(guildId: string, feedId: number, url: string) {
    try {
        const feed = await rssParser.parseURL(url);
        logger.info(`Processing RSS feed: ${feed.title} (${url})`);

        const { getDb } = await import('../../../shared/storage/persistence.js');
        const db = await getDb();

        for (const item of feed.items.slice(0, 5)) {
            // Check if this item has already been ingested
            const existing = await db.query(
                'SELECT id FROM hyperedges WHERE guildId = $1 AND metadata->>\'url\' = $2',
                [guildId, item.link]
            );

            if (existing.rows.length > 0) {
                logger.info(`Skipping already ingested RSS item: ${item.title}`);
                continue;
            }

            const { summary, entities } = await extractKnowledge(item.contentSnippet || item.content || item.title || '');
            
            await createHyperedge(guildId, {
                channelId: 'system-ingestion',
                edgeType: 'fact',
                summary: `RSS: ${item.title} - ${summary}`,
                content: item.link + '\n\n' + (item.contentSnippet || ''),
                importance: 0.6,
                memberships: entities.map(entity => ({
                    entity,
                    role: 'topic',
                    weight: 0.8
                })),
                metadata: { source: 'rss', url: item.link }
            });
        }

        await updateRssLastFetched(feedId);
    } catch (error) {
        logger.error(`Failed to process RSS feed ${url}`, error);
    }
}

/**
 * Process a document (PDF, Text, Markdown)
 */
export async function processDocument(guildId: string, docId: number, buffer: Buffer, filename: string) {
    try {
        await updateDocumentStatus(docId, { status: 'processing' });
        
        let text = '';
        const ext = filename.split('.').pop()?.toLowerCase();

        if (ext === 'pdf') {
            const parser = new pdf({ data: buffer });
            const data = await parser.getText();
            text = data.text;
            if (parser.destroy) await parser.destroy();
        } else if (ext === 'txt' || ext === 'md') {
            text = buffer.toString('utf-8');
        } else {
            throw new Error(`Unsupported file type: ${ext}`);
        }
        
        logger.info(`Processing document: ${filename} (${text.length} chars)`);

        const chunks = chunkText(text);
        logger.info(`Document ${filename} split into ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const keywords = extractKeywords(chunk);
            
            await createHyperedge(guildId, {
                channelId: 'system-ingestion',
                edgeType: 'fact',
                summary: `Document: ${filename} (Part ${i + 1}/${chunks.length})`,
                content: chunk,
                importance: 0.8,
                memberships: keywords.map(keyword => ({
                    entity: {
                        id: keyword.toLowerCase(),
                        name: keyword,
                        type: 'topic'
                    },
                    role: 'subject',
                    weight: 0.9
                })),
                metadata: { source: 'upload', filename, chunkIndex: i, totalChunks: chunks.length }
            });
        }

        await updateDocumentStatus(docId, { status: 'completed', processedAt: true });
    } catch (error) {
        logger.error(`Failed to process document ${filename}`, error);
        await updateDocumentStatus(docId, { status: 'error', errorMessage: (error as Error).message });
    }
}

/**
 * Background task to check all enabled RSS feeds
 */
export async function startRssInformer(guildId: string) {
    const feeds = await getRssFeeds(guildId);
    const enabledFeeds = feeds.filter((f: { enabled: boolean }) => f.enabled);
    
    for (const feed of enabledFeeds) {
        // Simple check: if never fetched or interval passed (with 10s leeway)
        const lastFetched = feed.lastFetchedAt ? new Date(feed.lastFetchedAt).getTime() : 0;
        const now = Date.now();
        const intervalMs = (feed.intervalMinutes || 60) * 60 * 1000;
        
        if (now - lastFetched >= intervalMs - 10000) {
            await processRssFeed(guildId, feed.id, feed.url);
        }
    }
}
