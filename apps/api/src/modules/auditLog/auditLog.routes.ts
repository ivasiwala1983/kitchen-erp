/**
 * Audit Log Module — Read-only audit trail viewer.
 *
 * Endpoints:
 *   GET /api/audit-logs — List audit logs for current tenant
 *
 * Also exports an `auditLog` helper for other modules to record actions.
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { parsePagination } from '@kitchen-erp/utils';
import { sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { Role } from '@kitchen-erp/types';

// ── Audit Logger Utility ──────────────────────────────────────

export interface AuditLogData {
  tenantId?: string | null;
  userId?: string | null;
  action: string; // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
  entity: string; // Tenant, User, Vendor, Product, Purchase, etc.
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Record an audit log entry. Non-blocking — errors are silently swallowed.
 */
export async function recordAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: data.tenantId || null,
        userId: data.userId || null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        oldValues: data.oldValues ? (data.oldValues as any) : undefined,
        newValues: data.newValues ? (data.newValues as any) : undefined,
        ip: data.ip || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (e) {
    console.error('[AuditLog] Failed to record:', e);
  }
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

    const where = {
      ...(activeTenantFilter ? { tenantId: activeTenantFilter } : {}),
      ...(entity && { entity: entity as string }),
      ...(userId && { userId: userId as string }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    sendPaginated(res, logs, total, p, l);
  } catch (e) {
    next(e);
  }
});

export default router;
