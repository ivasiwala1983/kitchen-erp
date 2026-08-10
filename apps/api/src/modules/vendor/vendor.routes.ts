import {
  vendorRepository as dbVendorRepository,
  categoryRepository as dbCategoryRepository,
  ledgerRepository as dbLedgerRepository,
} from '@kitchen-erp/database';
import { parsePagination } from '@kitchen-erp/utils';
import { NotFoundError, ConflictError } from '../../shared/errors';
import type {
  CreateVendorInput,
  UpdateVendorInput,
  QuickAddVendorInput,
} from './vendor.validation';
import { createVendorSchema, updateVendorSchema, quickAddVendorSchema } from './vendor.validation';
import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role } from '@kitchen-erp/types';
import { recordAuditLog } from '../auditLog/auditLog.routes';

// ── Repository Adapter ────────────────────────────────────────

class VendorRepository {
  async findAll(
    tenantId: string,
    params: { skip: number; take: number; search?: string; categoryId?: string }
  ) {
    return dbVendorRepository.findAll(tenantId, params);
  }

  async findById(id: string, tenantId: string) {
    return dbVendorRepository.findById(id, tenantId);
  }

  async findByName(tenantId: string, name: string) {
    return dbVendorRepository.findByName(tenantId, name);
  }

  async create(data: CreateVendorInput & { tenantId: string; createdBy: string }) {
    return dbVendorRepository.create({
      tenantId: data.tenantId,
      categoryId: data.categoryId,
      name: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      gst: data.gst || undefined,
      createdBy: data.createdBy,
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<UpdateVendorInput> & { updatedBy: string }
  ) {
    return dbVendorRepository.update(id, tenantId, data);
  }

  async softDelete(id: string, tenantId: string, deletedBy: string) {
    return dbVendorRepository.softDelete(id, tenantId, deletedBy);
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

  async quickAdd(tenantId: string, dto: QuickAddVendorInput, createdBy: string) {
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
          'Vendor already exists but is inactive. Please contact Tenant Admin.'
        );
      }
      return {
        created: false,
        existing: true,
        vendor: existing,
      };
    }

    try {
      const vendor = await this.repo.create({
        tenantId,
        categoryId: dto.categoryId,
        name: cleanName,
        createdBy,
      });

      // Ensure vendor ledger account exists
      await dbLedgerRepository.findOrCreateAccount(tenantId, vendor.id);

      return {
        created: true,
        existing: false,
        vendor,
      };
    } catch (e: unknown) {
      const err = e as { code?: string };
      // Race condition protection for unique constraint (P2002)
      if (err?.code === 'P2002') {
        const raceVendor = await this.repo.findByName(tenantId, cleanName);
        if (raceVendor) {
          if (!raceVendor.isActive) {
            throw new ConflictError(
              'Vendor already exists but is inactive. Please contact Tenant Admin.'
            );
          }
          return {
            created: false,
            existing: true,
            vendor: raceVendor,
          };
        }
      }
      throw e;
    }
  }

  async update(id: string, tenantId: string, dto: UpdateVendorInput, updatedBy: string) {
    await this.getById(id, tenantId);
    return this.repo.update(id, tenantId, { ...dto, updatedBy });
  }

  async delete(id: string, tenantId: string, deletedBy: string) {
    await this.getById(id, tenantId);
    await this.repo.softDelete(id, tenantId, deletedBy);
  }
}

// ── Controller + Routes ────────────────────────────────────────

const service = new VendorService();
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
      const vendor = await service.getById(String(req.params.id), authReq.tenantId);
      sendSuccess(res, vendor);
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

router.post(
  '/quick-add',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = quickAddVendorSchema.parse(req.body);
      const result = await service.quickAdd(authReq.tenantId, dto, authReq.user.sub);

      if (result.created) {
        recordAuditLog({
          tenantId: authReq.tenantId,
          userId: authReq.user.sub,
          action: 'VENDOR_QUICK_CREATED',
          entity: 'Vendor',
          entityId: result.vendor.id,
          newValues: {
            name: result.vendor.name,
            categoryId: result.vendor.categoryId,
            source: 'PWA_QUICK_ADD',
          },
        });
        return sendCreated(res, result, 'Vendor created successfully');
      } else {
        return sendSuccess(res, result, 'Vendor already exists.');
      }
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
        newValues: dto as Record<string, unknown>,
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
