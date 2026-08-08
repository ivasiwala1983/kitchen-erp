/**
 * Tenant Module — Controller
 */

import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';
import { createTenantSchema, updateTenantSchema } from './tenant.validation';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { recordAuditLog } from '../auditLog/auditLog.routes';

const service = new TenantService();

export async function listTenants(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, search } = req.query;
    const result = await service.list(Number(page), Number(limit), search as string);
    sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (e) {
    next(e);
  }
}

export async function getTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await service.getById(String(req.params.id));
    sendSuccess(res, tenant);
  } catch (e) {
    next(e);
  }
}

export async function getTenantBySlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const slug = String(req.params.slug);
    const tenant = await service.getBySlug(slug);
    sendSuccess(res, tenant);
  } catch (e) {
    next(e);
  }
}

export async function listPublicTenants(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenants = await service.getPublicList();
    sendSuccess(res, tenants);
  } catch (e) {
    next(e);
  }
}

export async function createTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const dto = createTenantSchema.parse(req.body);
    const tenant = await service.create(dto, authReq.user.sub);

    recordAuditLog({
      tenantId: tenant.id,
      userId: authReq.user.sub,
      action: 'CREATE',
      entity: 'Tenant',
      entityId: tenant.id,
      newValues: {
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        currency: tenant.currency,
      },
    });

    sendCreated(res, tenant, 'Tenant created successfully');
  } catch (e) {
    next(e);
  }
}

export async function updateTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const dto = updateTenantSchema.parse(req.body);
    const tenant = await service.update(String(req.params.id), dto, authReq.user.sub);

    recordAuditLog({
      tenantId: tenant.id,
      userId: authReq.user.sub,
      action: 'UPDATE',
      entity: 'Tenant',
      entityId: tenant.id,
      newValues: dto as any,
    });

    sendSuccess(res, tenant, 'Tenant updated');
  } catch (e) {
    next(e);
  }
}

export async function activateTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenant = await service.activate(String(req.params.id), authReq.user.sub);

    recordAuditLog({
      tenantId: tenant.id,
      userId: authReq.user.sub,
      action: 'UPDATE',
      entity: 'Tenant',
      entityId: tenant.id,
      newValues: { isActive: true },
    });

    sendSuccess(res, tenant, 'Tenant activated');
  } catch (e) {
    next(e);
  }
}

export async function deactivateTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenant = await service.deactivate(String(req.params.id), authReq.user.sub);

    recordAuditLog({
      tenantId: tenant.id,
      userId: authReq.user.sub,
      action: 'UPDATE',
      entity: 'Tenant',
      entityId: tenant.id,
      newValues: { isActive: false },
    });

    sendSuccess(res, tenant, 'Tenant deactivated');
  } catch (e) {
    next(e);
  }
}

export async function deleteTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const id = String(req.params.id);
    await service.delete(id, authReq.user.sub);

    recordAuditLog({
      tenantId: id,
      userId: authReq.user.sub,
      action: 'DELETE',
      entity: 'Tenant',
      entityId: id,
    });

    sendSuccess(res, null, 'Tenant deleted');
  } catch (e) {
    next(e);
  }
}
