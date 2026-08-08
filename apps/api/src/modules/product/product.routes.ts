/**
 * Product Module — Complete DDD Implementation
 */

import { z } from 'zod';
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { parsePagination } from '@kitchen-erp/utils';
import { NotFoundError } from '../../shared/errors';
import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role } from '@kitchen-erp/types';

// ── Validation ────────────────────────────────────────────────

const createProductSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().min(2).max(100),
  unit: z.string().min(1).max(20).default('kg'),
});

const updateProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2).max(100).optional(),
  unit: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

// ── Repository ────────────────────────────────────────────────

class ProductRepository {
  async findAll(
    tenantId: string,
    params: { skip: number; take: number; search?: string; categoryId?: string }
  ) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.search && { name: { contains: params.search, mode: 'insensitive' as const } }),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string, tenantId: string) {
    return prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    });
  }

  async create(data: {
    tenantId: string;
    categoryId: string;
    name: string;
    unit?: string;
    createdBy: string;
  }) {
    return prisma.product.create({
      data: {
        tenantId: data.tenantId,
        categoryId: data.categoryId,
        name: data.name,
        unit: data.unit || 'kg',
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      } as Prisma.ProductUncheckedCreateInput,
      include: { category: true },
    });
  }

  async update(
    id: string,
    data: {
      categoryId?: string;
      name?: string;
      unit?: string;
      isActive?: boolean;
      updatedBy: string;
    }
  ) {
    return prisma.product.update({
      where: { id },
      data: data as Prisma.ProductUncheckedUpdateInput,
      include: { category: true },
    });
  }

  async softDelete(id: string, deletedBy: string) {
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
  }
}

// ── Service ───────────────────────────────────────────────────

class ProductService {
  private repo = new ProductRepository();

  async list(
    tenantId: string,
    page?: number,
    limit?: number,
    search?: string,
    categoryId?: string
  ) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { items, total } = await this.repo.findAll(tenantId, {
      skip,
      take: l,
      search,
      categoryId,
    });
    return { data: items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getById(id: string, tenantId: string) {
    const product = await this.repo.findById(id, tenantId);
    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  async create(
    tenantId: string,
    dto: { categoryId?: string; name?: string; unit?: string },
    createdBy: string
  ) {
    if (!dto.categoryId || !dto.name) {
      throw new Error('Category ID and Name are required');
    }
    return this.repo.create({
      tenantId,
      categoryId: dto.categoryId,
      name: dto.name,
      unit: dto.unit || 'kg',
      createdBy,
    });
  }

  async update(
    id: string,
    tenantId: string,
    dto: { categoryId?: string; name?: string; unit?: string; isActive?: boolean },
    updatedBy: string
  ) {
    await this.getById(id, tenantId);
    return this.repo.update(id, { ...dto, updatedBy });
  }

  async delete(id: string, tenantId: string, deletedBy: string) {
    await this.getById(id, tenantId);
    await this.repo.softDelete(id, deletedBy);
  }
}

// ── Controller + Routes ────────────────────────────────────────

const service = new ProductService();
const router: Router = Router();

router.use(authenticate, resolveTenant, requireTenant);

router.get(
  '/',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { page, limit, search, categoryId } = req.query;
      const result = await service.list(
        authReq.tenantId,
        Number(page),
        Number(limit),
        search as string,
        categoryId as string
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
      sendSuccess(res, await service.getById(String(req.params.id), authReq.tenantId));
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
      const dto = createProductSchema.parse(req.body);
      const product = await service.create(authReq.tenantId, dto, authReq.user.sub);

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'CREATE',
        entity: 'Product',
        entityId: product.id,
        newValues: { name: product.name, unit: product.unit, categoryId: product.categoryId },
      });

      sendCreated(res, product, 'Product created');
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
      const dto = updateProductSchema.parse(req.body);
      const product = await service.update(
        String(req.params.id),
        authReq.tenantId,
        dto,
        authReq.user.sub
      );

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'UPDATE',
        entity: 'Product',
        entityId: product.id,
        newValues: dto as any,
      });

      sendSuccess(res, product, 'Product updated');
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
        entity: 'Product',
        entityId: id,
      });

      sendSuccess(res, null, 'Product deleted');
    } catch (e) {
      next(e);
    }
  }
);

export default router;
