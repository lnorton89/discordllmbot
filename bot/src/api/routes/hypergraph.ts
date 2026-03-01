/**
 * Hypergraph Routes
 *
 * REST endpoints for hypergraph memory system.
 *
 * @module bot/src/api/routes/hypergraph
 */

import { Router, Request, Response } from 'express';
import { logger } from '@shared/utils/logger.js';
import {
    getHypergraphStats,
    getNodesByType,
    getAllNodes,
    queryMemoriesByNode,
    getChannelMemories,
    getGraphData,
    createHyperedge,
    updateHypergraphConfig,
    updateMemoryUrgency,
    pruneLowUrgencyMemories,
} from '@shared/storage/hypergraphPersistence.js';

/**
 * Creates and returns the hypergraph routes.
 *
 * @returns Express router
 */
export function createHypergraphRoutes(): Router {
    const router = Router();

    router.get('/:guildId/stats', async (req: Request, res: Response) => {
        try {
            const stats = await getHypergraphStats(req.params.guildId as string);
            res.json(stats);
        } catch (err) {
            logger.error('Failed to fetch hypergraph stats', err);
            res.status(500).json({ error: 'Failed to fetch hypergraph stats' });
        }
    });

    router.get('/:guildId/nodes', async (req: Request, res: Response) => {
        try {
            const nodeType = req.query.type as string;
            const nodes = nodeType
                ? await getNodesByType(req.params.guildId as string, nodeType)
                : await getAllNodes(req.params.guildId as string);
            res.json(nodes);
        } catch (err) {
            logger.error('Failed to fetch nodes', err);
            res.status(500).json({ error: 'Failed to fetch nodes' });
        }
    });

    router.get('/:guildId/memories', async (req: Request, res: Response) => {
        try {
            const nodeId = req.query.node as string;
            const channelId = req.query.channelId as string;
            const minUrgency = parseFloat(req.query.minUrgency as string) || 0.1;
            const limit = parseInt(req.query.limit as string) || 20;

            let memories;
            if (nodeId) {
                memories = await queryMemoriesByNode(req.params.guildId as string, nodeId, minUrgency, limit);
            } else if (channelId) {
                memories = await getChannelMemories(req.params.guildId as string, channelId, minUrgency, limit);
            } else {
                return res.status(400).json({ error: 'Either nodeId or channelId parameter required' });
            }
            res.json(memories);
        } catch (err) {
            logger.error('Failed to fetch memories', err);
            res.status(500).json({ error: 'Failed to fetch memories' });
        }
    });

    router.get('/:guildId/graph', async (req: Request, res: Response) => {
        try {
            const channelId = req.query.channelId as string;
            const limit = parseInt(req.query.limit as string) || 100;
            const graph = await getGraphData(req.params.guildId as string, channelId || null, limit);
            res.json(graph);
        } catch (err) {
            logger.error('Failed to fetch graph data', err);
            res.status(500).json({ error: 'Failed to fetch graph data' });
        }
    });

    router.post('/:guildId/memories', async (req: Request, res: Response) => {
        try {
            if (!req.body.channelId) {
                return res.status(400).json({ error: 'channelId is required' });
            }
            const edgeId = await createHyperedge(req.params.guildId as string, req.body);
            logger.info(`Created manual memory ${edgeId} for guild ${req.params.guildId as string}`);
            res.json({ id: edgeId, message: 'Memory created successfully' });
        } catch (err) {
            logger.error('Failed to create memory', err);
            res.status(500).json({ error: 'Failed to create memory' });
        }
    });

    router.post('/:guildId/config', async (req: Request, res: Response) => {
        try {
            await updateHypergraphConfig(req.params.guildId as string, req.body);
            res.json({ message: 'Config updated successfully' });
        } catch (err) {
            logger.error('Failed to update hypergraph config', err);
            res.status(500).json({ error: 'Failed to update config' });
        }
    });

    router.post('/:guildId/decay', async (req: Request, res: Response) => {
        try {
            const { decayRate, minUrgencyThreshold } = req.body;
            const updated = await updateMemoryUrgency(req.params.guildId as string, decayRate || 0.1, 0.05);
            const pruned = await pruneLowUrgencyMemories(req.params.guildId as string, minUrgencyThreshold || 0.1);
            res.json({ message: 'Decay process complete', updated: updated.length, pruned });
        } catch (err) {
            logger.error('Failed to run decay process', err);
            res.status(500).json({ error: 'Failed to run decay process' });
        }
    });

    return router;
}
