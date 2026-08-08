/**
 * Tenant Module — Routes
 * All routes require SUPER_ADMIN role.
 */

import { Router } from 'express';
import {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  activateTenant,
  deactivateTenant,
  deleteTenant,
} from './tenant.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { Role } from '@kitchen-erp/types';

const router = Router();

router.use(authenticate, authorize(Role.SUPER_ADMIN));

router.get('/', listTenants);
router.get('/:id', getTenant);
router.post('/', createTenant);
router.patch('/:id', updateTenant);
router.patch('/:id/activate', activateTenant);
router.patch('/:id/deactivate', deactivateTenant);
router.delete('/:id', deleteTenant);

export default router;
