/**
 * Feature Management & Entitlement Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { authorize } from '../../middleware/role.middleware';
import { Role } from '@kitchen-erp/types';
import { getTenantFeatures, updateTenantFeature, getEffectiveFeatures } from './feature.controller';

const router = Router();

// Public/Tenant endpoint to get effective features map for authenticated user context
router.get('/effective', authenticate, resolveTenant, getEffectiveFeatures);

// Super Admin endpoints to manage tenant feature entitlements
router.get('/tenant/:id', authenticate, authorize(Role.SUPER_ADMIN), getTenantFeatures);
router.put('/tenant/:id', authenticate, authorize(Role.SUPER_ADMIN), updateTenantFeature);

export default router;
