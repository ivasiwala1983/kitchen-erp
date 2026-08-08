/**
 * Tenant Module — Routes
 * Public resolution by slug + Protected CRUD for SUPER_ADMIN.
 */

import { Router } from 'express';
import {
  listTenants,
  getTenant,
  getTenantBySlug,
  listPublicTenants,
  createTenant,
  updateTenant,
  activateTenant,
  deactivateTenant,
  deleteTenant,
} from './tenant.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { Role } from '@kitchen-erp/types';

const router: Router = Router();

// Public endpoints for path-based dynamic tenant lookup & dropdown list
router.get('/public-list', listPublicTenants);
router.get('/by-slug/:slug', getTenantBySlug);

// Protected tenant management routes (SUPER_ADMIN only)
router.get('/', authenticate, authorize(Role.SUPER_ADMIN), listTenants);
router.get('/:id', authenticate, authorize(Role.SUPER_ADMIN), getTenant);
router.post('/', authenticate, authorize(Role.SUPER_ADMIN), createTenant);
router.patch('/:id', authenticate, authorize(Role.SUPER_ADMIN), updateTenant);
router.patch('/:id/activate', authenticate, authorize(Role.SUPER_ADMIN), activateTenant);
router.patch('/:id/deactivate', authenticate, authorize(Role.SUPER_ADMIN), deactivateTenant);
router.delete('/:id', authenticate, authorize(Role.SUPER_ADMIN), deleteTenant);

export default router;
