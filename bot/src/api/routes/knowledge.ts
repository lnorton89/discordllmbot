/**
 * Knowledge Routes
 *
 * REST endpoints for knowledge ingestion (RSS feeds and document uploads).
 *
 * @module bot/src/api/routes/knowledge
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { logger } from '@shared/utils/logger.js';
import {
    createRssFeed,
    getRssFeeds,
    updateRssFeed,
    deleteRssFeed,
    createIngestedDocument,
    getIngestedDocuments,
    deleteIngestedDocument,
} from '@shared/storage/knowledgePersistence.js';
import { processDocument, processRssFeed } from '@core/knowledgeIngestion.js';

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Creates and returns the knowledge routes.
 *
 * @returns Express router
 */
export function createKnowledgeRoutes(): Router {
    const router = Router();

    router.get('/:guildId/rss', async (req: Request, res: Response) => {
        try {
            const feeds = await getRssFeeds(req.params.guildId as string);
            res.json(feeds);
        } catch (err) {
            logger.error('Failed to fetch RSS feeds', err);
            res.status(500).json({ error: 'Failed to fetch RSS feeds' });
        }
    });

    router.post('/:guildId/rss', async (req: Request, res: Response) => {
        try {
            const feed = await createRssFeed(req.params.guildId as string, req.body);
            // Trigger initial fetch
            processRssFeed(req.params.guildId as string, feed.id, feed.url).catch(e => logger.error('Initial RSS fetch failed', e));
            res.status(201).json(feed);
        } catch (err) {
            logger.error('Failed to create RSS feed', err);
            res.status(500).json({ error: 'Failed to create RSS feed' });
        }
    });

    router.patch('/:guildId/rss/:id', async (req: Request, res: Response) => {
        try {
            const feed = await updateRssFeed(parseInt(req.params.id as string), req.body);
            res.json(feed);
        } catch (err) {
            logger.error('Failed to update RSS feed', err);
            res.status(500).json({ error: 'Failed to update RSS feed' });
        }
    });

    router.delete('/:guildId/rss/:id', async (req: Request, res: Response) => {
        try {
            await deleteRssFeed(parseInt(req.params.id as string));
            res.status(204).send();
        } catch (err) {
            logger.error('Failed to delete RSS feed', err);
            res.status(500).json({ error: 'Failed to delete RSS feed' });
        }
    });

    router.get('/:guildId/documents', async (req: Request, res: Response) => {
        try {
            const docs = await getIngestedDocuments(req.params.guildId as string);
            res.json(docs);
        } catch (err) {
            logger.error('Failed to fetch documents', err);
            res.status(500).json({ error: 'Failed to fetch documents' });
        }
    });

    router.delete('/:guildId/documents/:id', async (req: Request, res: Response) => {
        try {
            await deleteIngestedDocument(parseInt(req.params.id as string));
            res.status(204).send();
        } catch (err) {
            logger.error('Failed to delete document', err);
            res.status(500).json({ error: 'Failed to delete document' });
        }
    });

    router.post('/:guildId/upload', upload.single('document'), async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const doc = await createIngestedDocument(req.params.guildId as string, {
                filename: req.file.originalname,
                fileType: req.file.mimetype
            });

            // Start processing in background
            processDocument(req.params.guildId as string, doc.id, req.file.buffer, req.file.originalname)
                .catch(e => logger.error(`Background processing failed for ${req.file?.originalname}`, e));

            res.status(202).json(doc);
        } catch (err) {
            logger.error('Failed to upload document', err);
            res.status(500).json({ error: 'Failed to upload document' });
        }
    });

    return router;
}
