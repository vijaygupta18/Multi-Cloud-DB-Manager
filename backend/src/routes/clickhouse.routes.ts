import { Router } from 'express';
import { getStatus, manualSync } from '../controllers/clickhouse.controller';
import { isAuthenticated, requireMaster } from '../middleware/auth.middleware';

const router = Router();

// GET /api/clickhouse/status — any authenticated user can check health
router.get('/status', isAuthenticated, getStatus);

// POST /api/clickhouse/sync — MASTER only (manual backfill trigger)
router.post('/sync', isAuthenticated, requireMaster, manualSync);

export default router;
