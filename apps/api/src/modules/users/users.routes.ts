/**
 * Users Module — Routes
 * Accessible by SUPER_ADMIN and TENANT_ADMIN only.
 */

import { Router } from 'express';
import { listUsers, getUser, createUser, updateUser, deleteUser } from './users.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role } from '@kitchen-erp/types';

const router = Router();

router.use(
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
  resolveTenant,
  requireTenant
);

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
