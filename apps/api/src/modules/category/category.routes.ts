/**
 * Category Master Module — Repository Adapter, Service, Controller, Routes
 * Consumes enterprise @kitchen-erp/database CategoryRepository.
 */

import { z } from 'zod';
import { categoryRepository as dbCategoryRepository } from '@kitchen-erp/database';
import { parsePagination } from '@kitchen-erp/utils';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { createCategorySchema, updateCategorySchema } from './category.validation';
import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role, CategoryType } from '@kitchen-erp/types';
import { recordAuditLog } from '../auditLog/auditLog.routes';

// ── Repository Adapter ────────────────────────────────────────

export class CategoryRepository {
  async findAll(
    tenantId: string,
    params: { skip: number; take: number; search?: string; isActive?: boolean }
  ) {
    const { items, total } = await dbCategoryRepository.findAll(tenantId, params);
    return { items, total };
  }

  async findById(id: string, tenantId: string) {
    return dbCategoryRepository.findById(id, tenantId);
  }

  async findByName(name: string, tenantId: string) {
    return dbCategoryRepository.findByName(name, tenantId);
  }

  async create(data: {
    tenantId: string;
    name: string;
    type?: CategoryType;
    displayOrder?: number;
    icon?: string | null;
    color?: string | null;
    description?: string | null;
    isActive?: boolean;
    createdBy: string;
  }) {
    return dbCategoryRepository.create({
      tenantId: data.tenantId,
      name: data.name,
      type: data.type,
      displayOrder: data.displayOrder,
      icon: data.icon || undefined,
      color: data.color || undefined,
      description: data.description || undefined,
      createdBy: data.createdBy,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      type?: CategoryType;
      displayOrder?: number;
      icon?: string | null;
      color?: string | null;
      description?: string | null;
      isActive?: boolean;
      updatedBy: string;
    }
  ) {
    return dbCategoryRepository.update(id, '', data);
  }

  async softDelete(id: string, deletedBy: string) {
    return dbCategoryRepository.softDelete(id, '', deletedBy);
  }
}

// ── Service ───────────────────────────────────────────────────

export class CategoryService {
  private repo = new CategoryRepository();

  async list(tenantId: string, page?: number, limit?: number, search?: string, isActive?: boolean) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { items, total } = await this.repo.findAll(tenantId, { skip, take: l, search, isActive });

    // Sort categories in ascending order by name at service level
    items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return { data: items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getById(id: string, tenantId: string) {
    const category = await this.repo.findById(id, tenantId);
    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  async create(tenantId: string, dto: z.infer<typeof createCategorySchema>, createdBy: string) {
    const existing = await this.repo.findByName(dto.name, tenantId);
    if (existing) throw new ConflictError(`Category with name "${dto.name}" already exists`);
    return this.repo.create({
      tenantId,
      name: dto.name,
      type: dto.type,
      displayOrder: dto.displayOrder,
      icon: dto.icon,
      color: dto.color,
      description: dto.description,
      isActive: dto.isActive,
      createdBy,
    });
  }

  async update(
    id: string,
    tenantId: string,
    dto: z.infer<typeof updateCategorySchema>,
    updatedBy: string
  ) {
    const category = await this.getById(id, tenantId);
    if (dto.name && dto.name.toLowerCase() !== category.name.toLowerCase()) {
      const existing = await this.repo.findByName(dto.name, tenantId);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Category with name "${dto.name}" already exists`);
      }
    }
    return this.repo.update(id, { ...dto, updatedBy });
  }

  async delete(id: string, tenantId: string, deletedBy: string) {
    await this.getById(id, tenantId);
    await this.repo.softDelete(id, deletedBy);
  }
}

// ── Controller + Routes ────────────────────────────────────────

const service = new CategoryService();
const router: Router = Router();

router.use(authenticate, resolveTenant, requireTenant);

router.get(
  '/',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { page, limit, search, isActive } = req.query;
      const isActiveBool = isActive !== undefined ? isActive === 'true' : undefined;
      const result = await service.list(
        authReq.tenantId,
        Number(page),
        Number(limit),
        search as string,
        isActiveBool
      );
      sendPaginated(res, result.data, result.total, result.page, result.limit);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const category = await service.getById(String(req.params.id), authReq.tenantId);
      sendSuccess(res, category);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = createCategorySchema.parse(req.body);
      const category = await service.create(authReq.tenantId, dto, authReq.user.sub);

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'CREATE',
        entity: 'VendorCategory',
        entityId: category.id,
        newValues: { name: category.name, displayOrder: category.displayOrder },
      });

      sendCreated(res, category, 'Category created');
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = updateCategorySchema.parse(req.body);
      const category = await service.update(
        String(req.params.id),
        authReq.tenantId,
        dto,
        authReq.user.sub
      );

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'UPDATE',
        entity: 'VendorCategory',
        entityId: category.id,
        newValues: dto as Record<string, unknown>,
      });

      sendSuccess(res, category, 'Category updated');
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = String(req.params.id);
      await service.delete(id, authReq.tenantId, authReq.user.sub);

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'DELETE',
        entity: 'VendorCategory',
        entityId: id,
      });

      sendSuccess(res, null, 'Category deleted');
    } catch (e) {
      next(e);
    }
  }
);

export default router;
