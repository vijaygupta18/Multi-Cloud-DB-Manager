import { Router } from 'express';
import { executeQuery, validateQuery, cancelQuery, getActiveExecutions, getExecutionStatus } from '../controllers/query.controller';
import { isAuthenticated, validateQueryPermissions } from '../middleware/auth.middleware';
import { validate, queryExecutionSchema } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// Execute query (with role-based permissions check) - returns executionId immediately
router.post('/execute', validate(queryExecutionSchema), validateQueryPermissions, executeQuery);

// Get execution status and results (for polling)
router.get('/status/:executionId', isAuthenticated, getExecutionStatus);

// Cancel an active query execution
router.post('/cancel/:executionId', isAuthenticated, cancelQuery);

  // Get list of active query executions
router.get('/active', isAuthenticated, getActiveExecutions);

// Validate query without executing
router.post('/validate', validateQuery);

export default router;
