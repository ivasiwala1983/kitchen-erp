/**
 * Vendor Module — Repository, Service, Controller, Routes
 */

import prisma from '../../config/database';
import { parsePagination } from '@kitchen-erp/utils';
import { NotFoundError } from '../../shared/errors';
import type { CreateVendorInput, UpdateVendorInput } from './vendor.validation';
import { createVendorSchema, updateVendorSchema } from './vendor.validation';
import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role } from '@kitchen-erp/types';

// ── Repository ────────────────────────────────────────────────

class VendorRepository {
  async findAll(
    tenantId: string,
    params: { skip: number; take: number; search?: string; categoryId?: string }
  ) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { phone: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      prisma.vendor.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string, tenantId: string) {
    return prisma.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    });
  }

  async create(data: CreateVendorInput & { tenantId: string; createdBy: string }) {
    return prisma.vendor.create({
      data: { ...data, updatedBy: data.createdBy },
      include: { category: true },
    });
  }

  async update(id: string, data: Partial<UpdateVendorInput> & { updatedBy: string }) {
    return prisma.vendor.update({ where: { id }, data, include: { category: true } });
  }

  async softDelete(id: string, deletedBy: string) {
    await prisma.vendor.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
  }
}

// ── Service ───────────────────────────────────────────────────

class VendorService {
  private repo = new VendorRepository();

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
    const vendor = await this.repo.findById(id, tenantId);
    if (!vendor) throw new NotFoundError('Vendor not found');
    return vendor;
  }

  async create(tenantId: string, dto: CreateVendorInput, createdBy: string) {
    return this.repo.create({ ...dto, tenantId, createdBy });
  }

  async update(id: string, tenantId: string, dto: UpdateVendorInput, updatedBy: string) {
    await this.getById(id, tenantId);
    return this.repo.update(id, { ...dto, updatedBy });
  }

  async delete(id: string, tenantId: string, deletedBy: string) {
    await this.getById(id, tenantId);
    await this.repo.softDelete(id, deletedBy);
  }
}

// ── Controller + Routes ────────────────────────────────────────

const service = new VendorService();
const router = Router();

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
      const vendor = await service.getById(String(req.params.id), authReq.tenantId);
      sendSuccess(res, vendor);
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
      const dto = createVendorSchema.parse(req.body);
      const vendor = await service.create(authReq.tenantId, dto, authReq.user.sub);

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'CREATE',
        entity: 'Vendor',
        entityId: vendor.id,
        newValues: { name: vendor.name, phone: vendor.phone, categoryId: vendor.categoryId },
      });

      sendCreated(res, vendor, 'Vendor created');
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
      const dto = updateVendorSchema.parse(req.body);
      const vendor = await service.update(
        String(req.params.id),
        authReq.tenantId,
        dto,
        authReq.user.sub
      );

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'UPDATE',
        entity: 'Vendor',
        entityId: vendor.id,
        newValues: dto as any,
      });

      sendSuccess(res, vendor, 'Vendor updated');
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
        entity: 'Vendor',
        entityId: id,
      });

      sendSuccess(res, null, 'Vendor deleted');
    } catch (e) {
      next(e);
    }
  }
);

export default router;
