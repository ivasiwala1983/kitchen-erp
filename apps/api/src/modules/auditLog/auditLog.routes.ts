/**
 * Audit Log Module — Read-only audit trail viewer.
 * Consumes enterprise @kitchen-erp/database AuditRepository and AuditLoggerService.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { auditRepository, AuditLoggerService } from '@kitchen-erp/database';
import { parsePagination } from '@kitchen-erp/utils';
import { sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { Role } from '@kitchen-erp/types';

export interface AuditLogData {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Record an audit log entry. Non-blocking wrapper.
 */
export async function recordAuditLog(data: AuditLogData): Promise<void> {
  await AuditLoggerService.log(data);
}

// ── Routes ────────────────────────────────────────────────────

const router: Router = Router();

router.use(authenticate, authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN), resolveTenant);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, entity, userId, tenantId } = req.query;
    const { page: p, limit: l, skip } = parsePagination(Number(page), Number(limit));

    const activeTenantFilter = authReq.tenantId || (tenantId as string) || undefined;

    const { items, total } = await auditRepository.findAll({
      skip,
      take: l,
      tenantId: activeTenantFilter,
      userId: userId as string,
      entity: entity as string,
    });

    sendPaginated(res, items, total, p, l);
  } catch (e) {
    next(e);
  }
});

export default router;
