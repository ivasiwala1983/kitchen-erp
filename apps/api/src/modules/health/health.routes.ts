/**
 * Health Check Routes
 * Handles GET /health and OPTIONS /health requests.
 */

import { Router } from 'express';
import { getHealthStatus } from './health.controller';

const router = Router();

// GET /health
router.get('/', getHealthStatus);

// OPTIONS /health
router.options('/', (_req, res) => {
  res.status(200).end();
});

export default router;
