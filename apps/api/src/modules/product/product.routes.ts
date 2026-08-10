/**
 * Product Module — Repository Adapter, Service, Controller, Routes
 * Consumes enterprise @kitchen-erp/database ProductRepository.
 */

import { z } from 'zod';
import {
  productRepository as dbProductRepository,
  categoryRepository as dbCategoryRepository,
} from '@kitchen-erp/database';
import { parsePagination } from '@kitchen-erp/utils';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { requireFeature } from '../../middleware/feature.middleware';
import { Role, FeatureCode } from '@kitchen-erp/types';
import { recordAuditLog } from '../auditLog/auditLog.routes';

// ── Validation ────────────────────────────────────────────────

const createProductSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().min(2).max(100),
  unit: z.string().min(1).max(20).default('kg'),
});

const quickAddProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(100),
  categoryId: z.string().uuid('Invalid category ID'),
  unit: z.string().trim().optional().default('kg'),
});
type QuickAddProductInput = z.infer<typeof quickAddProductSchema>;

const updateProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2).max(100).optional(),
  unit: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

// ── Repository Adapter ────────────────────────────────────────

class ProductRepository {
  async findAll(
    tenantId: string,
    params: { skip: number; take: number; search?: string; categoryId?: string }
  ) {
    return dbProductRepository.findAll(tenantId, params);
  }

  async findById(id: string, tenantId: string) {
    return dbProductRepository.findById(id, tenantId);
  }

  async findByName(tenantId: string, name: string) {
    return dbProductRepository.findByName(tenantId, name);
  }

  async create(data: {
    tenantId: string;
    categoryId: string;
    name: string;
    unit?: string;
    createdBy: string;
  }) {
    return dbProductRepository.create(data);
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      categoryId?: string;
      name?: string;
      unit?: string;
      isActive?: boolean;
      updatedBy: string;
    }
  ) {
    return dbProductRepository.update(id, tenantId, data);
  }

  async softDelete(id: string, tenantId: string, deletedBy: string) {
    return dbProductRepository.softDelete(id, tenantId, deletedBy);
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

  async quickAdd(tenantId: string, dto: QuickAddProductInput, createdBy: string) {
    const cleanName = dto.name.trim();

    // Verify category exists and belongs to current tenant
    const category = await dbCategoryRepository.findById(dto.categoryId, tenantId);
    if (!category) {
      throw new NotFoundError('Category not found for this tenant');
    }

    // Tenant-scoped duplicate check (case & space insensitive)
    const existing = await this.repo.findByName(tenantId, cleanName);
    if (existing) {
      if (!existing.isActive) {
        throw new ConflictError(
          'Product already exists but is inactive. Please contact Tenant Admin.'
        );
      }
      return {
        created: false,
        existing: true,
        product: existing,
      };
    }

    try {
      const product = await this.repo.create({
        tenantId,
        categoryId: dto.categoryId,
        name: cleanName,
        unit: dto.unit || 'kg',
        createdBy,
      });

      return {
        created: true,
        existing: false,
        product,
      };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === 'P2002') {
        const raceProduct = await this.repo.findByName(tenantId, cleanName);
        if (raceProduct) {
          if (!raceProduct.isActive) {
            throw new ConflictError(
              'Product already exists but is inactive. Please contact Tenant Admin.'
            );
          }
          return {
            created: false,
            existing: true,
            product: raceProduct,
          };
        }
      }
      throw e;
    }
  }

  async update(
    id: string,
    tenantId: string,
    dto: { categoryId?: string; name?: string; unit?: string; isActive?: boolean },
    updatedBy: string
  ) {
    await this.getById(id, tenantId);
    return this.repo.update(id, tenantId, { ...dto, updatedBy });
  }

  async delete(id: string, tenantId: string, deletedBy: string) {
    await this.getById(id, tenantId);
    await this.repo.softDelete(id, tenantId, deletedBy);
  }
}

// ── Controller + Routes ────────────────────────────────────────

const service = new ProductService();
const router: Router = Router();

router.use(
  authenticate,
  resolveTenant,
  requireTenant,
  requireFeature(FeatureCode.FEATURE_PRODUCTS)
);

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

router.post(
  '/quick-add',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = quickAddProductSchema.parse(req.body);
      const result = await service.quickAdd(authReq.tenantId, dto, authReq.user.sub);

      if (result.created) {
        recordAuditLog({
          tenantId: authReq.tenantId,
          userId: authReq.user.sub,
          action: 'CREATE',
          entity: 'Product',
          entityId: result.product.id,
          newValues: {
            name: result.product.name,
            categoryId: result.product.categoryId,
            unit: result.product.unit,
            quickCreated: true,
          },
        });
      }

      sendCreated(res, result, result.created ? 'Product created' : 'Existing product returned');
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
        newValues: dto as Record<string, unknown>,
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

export const productService = service;
export { ProductService, quickAddProductSchema };
export default router;
