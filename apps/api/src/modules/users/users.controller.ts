/**
 * Users Module — Controller
 */

import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { createUserSchema, updateUserSchema } from './users.validation';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { recordAuditLog } from '../auditLog/auditLog.routes';

const service = new UsersService();

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, search } = req.query;
    const result = await service.list(
      authReq.tenantId,
      Number(page),
      Number(limit),
      search as string
    );
    sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (e) {
    next(e);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await service.getById(String(req.params.id), authReq.tenantId);
    sendSuccess(res, user);
  } catch (e) {
    next(e);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const dto = createUserSchema.parse(req.body);
    const user = await service.create(authReq.tenantId, dto, authReq.user.sub, authReq.user.role);

    recordAuditLog({
      tenantId: authReq.tenantId,
      userId: authReq.user.sub,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      newValues: { email: user.email, name: user.name, role: user.role },
    });

    sendCreated(res, user, 'User created successfully');
  } catch (e) {
    next(e);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const dto = updateUserSchema.parse(req.body);
    const user = await service.update(
      String(req.params.id),
      authReq.tenantId,
      dto,
      authReq.user.sub
    );

    recordAuditLog({
      tenantId: authReq.tenantId,
      userId: authReq.user.sub,
      action: 'UPDATE',
      entity: 'User',
      entityId: user.id,
      newValues: dto as Record<string, unknown>,
    });

    sendSuccess(res, user, 'User updated');
  } catch (e) {
    next(e);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const id = String(req.params.id);
    await service.delete(id, authReq.tenantId, authReq.user.sub, authReq.user.role);

    recordAuditLog({
      tenantId: authReq.tenantId,
      userId: authReq.user.sub,
      action: 'DELETE',
      entity: 'User',
      entityId: id,
    });

    sendSuccess(res, null, 'User deleted');
  } catch (e) {
    next(e);
  }
}
