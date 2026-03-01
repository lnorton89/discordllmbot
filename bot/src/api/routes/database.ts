/**
 * Database Routes
 *
 * REST endpoints for database exploration and management.
 *
 * @module bot/src/api/routes/database
 */

import { Router, Request, Response } from 'express';

import { getDb } from '@shared/storage/persistence';
import { logger } from '@shared/utils/logger.js';

/**
 * Create database routes router.
 */
export function createDatabaseRoutes(): Router {
    const router = Router();

    /**
     * GET /api/db/tables - Get list of all tables
     */
    router.get('/db/tables', async (_req: Request, res: Response) => {
        try {
            const db = await getDb();
            const result = await db.query(`
                SELECT table_name, 
                       (SELECT COUNT(*) FROM information_schema.columns c 
                        WHERE c.table_name = t.table_name) as column_count
                FROM information_schema.tables t
                WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
                ORDER BY table_name
            `);
            res.json(result.rows);
        } catch (err) {
            logger.error('Failed to fetch database tables', err);
            res.status(500).json({ error: 'Failed to fetch database tables' });
        }
    });

    /**
     * GET /api/db/tables/:tableName/schema - Get table schema
     */
    router.get('/db/tables/:tableName/schema', async (req: Request, res: Response) => {
        try {
            const tableName = req.params.tableName as string;
            const db = await getDb();

            const columnsRes = await db.query(`
                SELECT information_schema.columns.column_name, data_type, is_nullable,
                       CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
                FROM information_schema.columns
                LEFT JOIN (
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_name = $1
                ) pk ON information_schema.columns.column_name = pk.column_name
                WHERE information_schema.columns.table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);

            const foreignKeysRes = await db.query(`
                SELECT kcu.column_name,
                       ccu.table_name AS foreign_table_name,
                       ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                    ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = $1
            `, [tableName]);

            const foreignKeys: Record<string, { table: string; column: string }> = {};
            for (const row of foreignKeysRes.rows as Array<{ column_name: string; foreign_table_name: string; foreign_column_name: string }>) {
                foreignKeys[row.column_name] = {
                    table: row.foreign_table_name,
                    column: row.foreign_column_name,
                };
            }

            res.json({
                columns: columnsRes.rows,
                foreignKeys,
            });
        } catch (err) {
            logger.error('Failed to fetch table schema', err);
            res.status(500).json({ error: 'Failed to fetch table schema' });
        }
    });

    /**
     * GET /api/db/tables/:tableName/data - Get table data with pagination
     */
    router.get('/db/tables/:tableName/data', async (req: Request, res: Response) => {
        try {
            const tableName = req.params.tableName as string;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = (page - 1) * limit;

            const db = await getDb();

            const countRes = await db.query(
                `SELECT COUNT(*) as total FROM ${tableName}`
            );
            const total = parseInt((countRes.rows[0] as { total: string }).total);

            const dataRes = await db.query(
                `SELECT * FROM ${tableName} ORDER BY 1 OFFSET $1 LIMIT $2`,
                [offset, limit]
            );

            res.json({
                data: dataRes.rows as Array<Record<string, unknown>>,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            });
        } catch (err) {
            logger.error('Failed to fetch table data', err);
            res.status(500).json({ error: 'Failed to fetch table data' });
        }
    });

    /**
     * GET /api/db/relationships - Get table relationships
     */
    router.get('/db/relationships', async (_req: Request, res: Response) => {
        try {
            const db = await getDb();
            const result = await db.query(`
                SELECT 
                    kcu.table_name AS from_table,
                    kcu.column_name AS from_column,
                    ccu.table_name AS to_table,
                    ccu.column_name AS to_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                    ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                ORDER BY kcu.table_name, kcu.column_name
            `);
            res.json(result.rows);
        } catch (err) {
            logger.error('Failed to fetch database relationships', err);
            res.status(500).json({ error: 'Failed to fetch database relationships' });
        }
    });

    return router;
}
