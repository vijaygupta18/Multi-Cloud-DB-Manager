import { Request, Response } from 'express';
import ClickHouseClientManager from '../config/clickhouse';
import clickHouseSyncService from '../services/clickhouse/ClickHouseSyncService';
import DatabasePools from '../config/database';
import logger from '../utils/logger';

/**
 * GET /api/clickhouse/status
 * Returns ClickHouse connection health.
 */
export async function getStatus(req: Request, res: Response): Promise<void> {
    const ch = ClickHouseClientManager.getInstance();

    if (!ch) {
        res.json({
            status: 'disabled',
            clickhouse: 'not configured',
            message: 'No clickhouse.json found — ClickHouse sync is disabled',
        });
        return;
    }

    try {
        const alive = await ch.ping();
        res.json({
            status: alive ? 'ok' : 'error',
            clickhouse: alive ? 'connected' : 'unreachable',
            host: ch.config.host,
            database: ch.config.database,
        });
    } catch (err: any) {
        res.status(503).json({
            status: 'error',
            clickhouse: 'unreachable',
            error: err.message,
        });
    }
}

/**
 * POST /api/clickhouse/sync
 * Body: { sql: string, database: string, schema?: string }
 *
 * Manually trigger ClickHouse sync for a given SQL statement + PG database.
 * Useful for backfilling a table that was created before the sync feature was added.
 */
export async function manualSync(req: Request, res: Response): Promise<void> {
    const { sql, database, schema } = req.body as {
        sql: string;
        database: string;
        schema?: string;
    };

    if (!sql || !database) {
        res.status(400).json({ error: 'sql and database are required' });
        return;
    }

    const dbPools = DatabasePools.getInstance();
    const cloudConfig = dbPools.getCloudConfig();

    // Use primary cloud pool for the given database
    const pool = dbPools.getPoolByName(cloudConfig.primaryCloud, database);
    if (!pool) {
        res.status(404).json({ error: `Database '${database}' not found in primary cloud` });
        return;
    }

    const pgSchema = schema || 'public';

    try {
        const result = await clickHouseSyncService.syncAfterQuery(sql, pool, pgSchema);
        res.json(result);
    } catch (err: any) {
        logger.error('Manual CH sync failed', { error: err.message });
        res.status(500).json({ success: false, error: err.message });
    }
}
