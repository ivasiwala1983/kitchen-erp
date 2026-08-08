/**
 * Category Master Module — Repository, Service, Controller, Routes
 */

import prisma from '../../config/database';
import { parsePagination } from '@kitchen-erp/utils';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { createCategorySchema, updateCategorySchema } from './category.validation';
import type {
  createCategorySchema as CreateCategoryInput,
  updateCategorySchema as UpdateCategoryInput,
} from './category.validation';
import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role } from '@kitchen-erp/types';

// ── Repository ────────────────────────────────────────────────

export class CategoryRepository {
  async findAll(
    tenantId: string,
    params: { skip: number; take: number; search?: string; isActive?: boolean }
  ) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.search && { name: { contains: params.search, mode: 'insensitive' as const } }),
    };

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { vendors: true, products: true } },
        },
      }),
      prisma.category.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string, tenantId: string) {
    return prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: { select: { vendors: true, products: true } },
      },
    });
  }

  async findByName(name: string, tenantId: string) {
    return prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, tenantId, deletedAt: null },
    });
  }

  async create(data: {
    tenantId: string;
    name: string;
    displayOrder?: number;
    icon?: string | null;
    color?: string | null;
    description?: string | null;
    isActive?: boolean;
    createdBy: string;
  }) {
    return prisma.category.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        displayOrder: data.displayOrder ?? 0,
        icon: data.icon,
        color: data.color,
        description: data.description,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      displayOrder?: number;
      icon?: string | null;
      color?: string | null;
      description?: string | null;
      isActive?: boolean;
      updatedBy: string;
    }
  ) {
    return prisma.category.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy: string) {
    await prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
  }
}

// ── Service ───────────────────────────────────────────────────

export class CategoryService {
  private repo = new CategoryRepository();

  async list(tenantId: string, page?: number, limit?: number, search?: string, isActive?: boolean) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { items, total } = await this.repo.findAll(tenantId, { skip, take: l, search, isActive });
    return { data: items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getById(id: string, tenantId: string) {
    const category = await this.repo.findById(id, tenantId);
    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  async create(tenantId: string, dto: any, createdBy: string) {
    const existing = await this.repo.findByName(dto.name, tenantId);
    if (existing) throw new ConflictError(`Category with name "${dto.name}" already exists`);
    return this.repo.create({ ...dto, tenantId, createdBy });
  }

  async update(id: string, tenantId: string, dto: any, updatedBy: string) {
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
const router = Router();

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

import { recordAuditLog } from '../auditLog/auditLog.routes';

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
        newValues: dto as any,
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
