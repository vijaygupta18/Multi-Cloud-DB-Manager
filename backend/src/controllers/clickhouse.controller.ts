import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import ClickHouseClientManager from '../config/clickhouse';
import clickHouseSyncService from '../services/clickhouse/ClickHouseSyncService';
import historyService from '../services/history.service';
import DatabasePools from '../config/database';
import logger from '../utils/logger';

const CH_DATABASE_LABEL = 'clickhouse';
const READ_ONLY_RE = /^(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b/i;

/**
 * Strip leading SQL comments (line + block) and whitespace so the read-vs-write
 * detection regex matches against the first real keyword. Internal comments
 * are preserved — only the leading run is removed.
 */
function stripLeadingSqlComments(s: string): string {
    return s.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s+)+/g, '');
}

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

/**
 * POST /api/clickhouse/query
 * Body: { query: string }
 *
 * Run an arbitrary ClickHouse statement. SELECT/WITH/SHOW/DESCRIBE/EXPLAIN
 * use the JSON format and return rows + column metadata; everything else
 * is treated as DDL/DML and executed via client.exec.
 *
 * Writes are recorded in dual_db_manager.query_history with
 * database_name='clickhouse'; reads are skipped by historyService.
 */
export async function executeQuery(req: Request, res: Response): Promise<void> {
    const ch = ClickHouseClientManager.getInstance();
    if (!ch) {
        res.status(503).json({ error: 'ClickHouse not configured' });
        return;
    }

    const { query } = req.body as { query: string };
    const user = req.user as Express.User;
    const executionId = randomUUID();
    const startedAt = Date.now();
    const trimmed = query.trim();
    // Strip leading comments before keyword detection so a SELECT preceded by
    // `-- ...` or `/* ... */` is correctly classified as a read.
    const forKeyword = stripLeadingSqlComments(trimmed);
    const isRead = READ_ONLY_RE.test(forKeyword);
    const command = forKeyword.split(/\s+/)[0]?.toUpperCase() ?? 'UNKNOWN';

    try {
        let rows: Array<Record<string, unknown>> = [];
        let fields: Array<{ name: string; dataTypeID: number }> = [];

        if (isRead) {
            const { rows: r, meta } = await ch.queryWithMeta(trimmed);
            rows = r;
            fields = meta.map((m) => ({ name: m.name, dataTypeID: 0 }));
        } else {
            await ch.exec(trimmed);
        }

        const duration_ms = Date.now() - startedAt;
        const response = {
            id: executionId,
            success: true,
            clickhouse: {
                success: true,
                duration_ms,
                result: {
                    rows,
                    fields,
                    rowCount: rows.length,
                    command,
                },
            },
        };

        try {
            await historyService.saveQueryExecution(
                user.id,
                trimmed,
                CH_DATABASE_LABEL,
                CH_DATABASE_LABEL,
                response as any,
            );
        } catch (e: any) {
            logger.warn('CH history save failed (non-fatal)', { error: e.message });
        }

        res.json(response);
    } catch (err: any) {
        const duration_ms = Date.now() - startedAt;
        const response = {
            id: executionId,
            success: false,
            clickhouse: {
                success: false,
                duration_ms,
                error: err.message,
            },
        };

        try {
            await historyService.saveQueryExecution(
                user.id,
                trimmed,
                CH_DATABASE_LABEL,
                CH_DATABASE_LABEL,
                response as any,
            );
        } catch {
            // intentional: history failure must not mask the original error
        }

        // Match the PG path: an executed-but-failed query is a 200 with
        // success: false in the body, so the global axios interceptor
        // doesn't toast "An unexpected error occurred" on top of the
        // toolbar's own error UI. 5xx is reserved for infra failures
        // (CH unreachable / not configured) which are handled above.
        logger.error('CH query failed', { error: err.message, user: user?.username });
        res.status(200).json(response);
    }
}
