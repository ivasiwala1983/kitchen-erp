/**
 * ArgusOne AI Express Routes
 */

import { Router, RequestHandler } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { requireFeature } from '../../middleware/feature.middleware';
import { FeatureCode } from '@kitchen-erp/types';
import { chatController } from './ai.controller';

const router = Router();

// Protect all AI endpoints with Auth, Tenant isolation & Feature entitlement
router.use(authenticate as unknown as RequestHandler);
router.use(resolveTenant as unknown as RequestHandler);
router.use(requireTenant as unknown as RequestHandler);
router.use(requireFeature(FeatureCode.FEATURE_AI_ASSISTANT) as unknown as RequestHandler);

router.post('/chat', chatController as unknown as RequestHandler);

export default router;
