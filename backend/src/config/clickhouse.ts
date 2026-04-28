import { createClient, ClickHouseClient } from '@clickhouse/client';
import logger from '../utils/logger';
import { loadClickHouseConfig, ClickHouseConfig } from './clickhouse-config-loader';

/**
 * Singleton ClickHouse client manager.
 * Mirrors the DatabasePools singleton pattern.
 * Returns null from getInstance() if no clickhouse.json is configured.
 */
class ClickHouseClientManager {
    private static instance: ClickHouseClientManager | null = null;
    private static initialized = false;

    private client: ClickHouseClient;
    public readonly config: ClickHouseConfig;

    private constructor(config: ClickHouseConfig) {
        this.config = config;
        this.client = createClient({
            host: `http://${config.host}:${config.port}`,
            username: config.user,
            password: config.password,
            database: config.database,
            request_timeout: 30_000,
            compression: { response: true, request: false },
            clickhouse_settings: {
                async_insert: 0,
            },
        });
        logger.info('ClickHouse client created', {
            host: config.host,
            port: config.port,
            database: config.database,
        });
    }

    public static getInstance(): ClickHouseClientManager | null {
        if (!ClickHouseClientManager.initialized) {
            ClickHouseClientManager.initialized = true;
            try {
                const config = loadClickHouseConfig();
                if (!config) {
                    logger.info('ClickHouse sync disabled — no configuration found');
                    return null;
                }
                ClickHouseClientManager.instance = new ClickHouseClientManager(config);
            } catch (err) {
                logger.error('Failed to initialize ClickHouse client:', err);
                return null;
            }
        }
        return ClickHouseClientManager.instance;
    }

    /**
     * Execute a raw DDL or query string against ClickHouse.
     */
    public async exec(query: string): Promise<void> {
        logger.debug('CH exec:', { query: query.slice(0, 200) });
        await this.client.exec({ query });
    }

    /**
     * Run a SELECT and return rows as an array of objects.
     */
    public async query<T = Record<string, unknown>>(query: string): Promise<T[]> {
        logger.debug('CH query:', { query: query.slice(0, 200) });
        const result = await this.client.query({ query, format: 'JSONEachRow' });
        return result.json<T>();
    }

    /**
     * Run a SELECT and return rows + column metadata.
     * Used by the user-facing query endpoint where the UI needs column names/types.
     */
    public async queryWithMeta(query: string): Promise<{
        rows: Array<Record<string, unknown>>;
        meta: Array<{ name: string; type: string }>;
    }> {
        logger.debug('CH queryWithMeta:', { query: query.slice(0, 200) });
        const result = await this.client.query({ query, format: 'JSON' });
        const json = await result.json<any>();
        return { rows: json.data ?? [], meta: json.meta ?? [] };
    }

    /**
     * Ping ClickHouse — returns true if reachable.
     */
    public async ping(): Promise<boolean> {
        try {
            const ok = await this.client.ping();
            return ok.success;
        } catch {
            return false;
        }
    }

    public async shutdown(): Promise<void> {
        await this.client.close();
        logger.info('ClickHouse client closed');
    }
}

export default ClickHouseClientManager;
