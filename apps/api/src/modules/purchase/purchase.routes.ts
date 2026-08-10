/**
 * Purchase Module — Repository Adapter, Service, Controller, Routes
 * Consumes enterprise @kitchen-erp/database PurchaseRepository.
 */

import { z } from 'zod';
import {
  purchaseRepository as dbPurchaseRepository,
  PurchaseStatus as DbPurchaseStatus,
} from '@kitchen-erp/database';
import { parsePagination } from '@kitchen-erp/utils';
import { NotFoundError } from '../../shared/errors';
import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { requireFeature } from '../../middleware/feature.middleware';
import { Role, PurchaseStatus, FeatureCode } from '@kitchen-erp/types';
import { recordAuditLog } from '../auditLog/auditLog.routes';

// ── Validation ────────────────────────────────────────────────

const purchaseItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  qty: z.number().positive('Qty must be positive').multipleOf(0.001),
  rate: z.number().positive('Rate must be positive').multipleOf(0.01),
});

const createPurchaseSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor ID'),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
  notes: z.string().max(1000).optional(),
  purchaseDate: z.string().datetime().optional(),
  status: z.nativeEnum(PurchaseStatus).optional(),
});

const updatePurchaseSchema = z.object({
  vendorId: z.string().uuid().optional(),
  items: z.array(purchaseItemSchema).min(1).optional(),
  notes: z.string().max(1000).optional(),
  status: z.nativeEnum(PurchaseStatus).optional(),
});

// ── Repository Adapter ────────────────────────────────────────

class PurchaseRepository {
  async findAll(
    tenantId: string,
    params: {
      skip: number;
      take: number;
      search?: string;
      vendorId?: string;
      categoryId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      invoiceAvailable?: boolean;
    }
  ) {
    return dbPurchaseRepository.findAll(tenantId, {
      ...params,
      status: params.status as DbPurchaseStatus,
    });
  }

  async findById(id: string, tenantId: string) {
    return dbPurchaseRepository.findById(id, tenantId);
  }

  async create(data: {
    tenantId: string;
    vendorId: string;
    userId: string;
    notes?: string;
    purchaseDate?: Date;
    status: PurchaseStatus;
    createdBy: string;
    items: Array<{ productId: string; qty: number; rate: number }>;
  }) {
    return dbPurchaseRepository.create({
      tenantId: data.tenantId,
      vendorId: data.vendorId,
      userId: data.userId,
      items: data.items,
      notes: data.notes,
      purchaseDate: data.purchaseDate,
      status: data.status as DbPurchaseStatus,
    });
  }

  async update(
    id: string,
    data: {
      vendorId?: string;
      notes?: string;
      status?: string;
      invoiceUrl?: string;
      invoiceFid?: string;
      updatedBy: string;
    },
    newItems?: Array<{ productId: string; qty: number; rate: number }>
  ) {
    return dbPurchaseRepository.update(id, '', {
      vendorId: data.vendorId,
      notes: data.notes,
      status: data.status as DbPurchaseStatus,
      invoiceUrl: data.invoiceUrl,
      invoiceFid: data.invoiceFid,
      items: newItems,
      updatedBy: data.updatedBy,
    });
  }

  async softDelete(id: string, deletedBy: string) {
    return dbPurchaseRepository.softDelete(id, '', deletedBy);
  }
}

// ── Service ───────────────────────────────────────────────────

class PurchaseService {
  private repo = new PurchaseRepository();

  async list(
    tenantId: string,
    userId: string,
    userRole: Role,
    page?: number,
    limit?: number,
    filters?: {
      search?: string;
      vendorId?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      invoiceAvailable?: boolean;
    }
  ) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { items, total } = await this.repo.findAll(tenantId, {
      skip,
      take: l,
      ...filters,
    });
    return { data: items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getById(id: string, tenantId: string, _userId: string, _userRole: Role) {
    const purchase = await this.repo.findById(id, tenantId);
    if (!purchase) throw new NotFoundError('Purchase not found');
    return purchase;
  }

  async create(tenantId: string, dto: z.infer<typeof createPurchaseSchema>, userId: string) {
    return this.repo.create({
      tenantId,
      vendorId: dto.vendorId,
      userId,
      notes: dto.notes,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
      status: dto.status || PurchaseStatus.CONFIRMED,
      createdBy: userId,
      items: dto.items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        rate: item.rate,
      })),
    });
  }

  async update(
    id: string,
    tenantId: string,
    dto: z.infer<typeof updatePurchaseSchema>,
    userId: string,
    userRole: Role
  ) {
    await this.getById(id, tenantId, userId, userRole);

    return this.repo.update(
      id,
      {
        ...(dto.vendorId && { vendorId: dto.vendorId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status && { status: dto.status }),
        updatedBy: userId,
      },
      dto.items
        ? dto.items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            rate: item.rate,
          }))
        : undefined
    );
  }

  async updateInvoice(
    id: string,
    tenantId: string,
    invoiceUrl: string,
    invoiceFid: string | undefined,
    userId: string
  ) {
    await this.repo.findById(id, tenantId);
    return this.repo.update(id, {
      invoiceUrl,
      ...(invoiceFid && { invoiceFid }),
      updatedBy: userId,
    });
  }

  async delete(id: string, tenantId: string, userId: string, userRole: Role) {
    await this.getById(id, tenantId, userId, userRole);
    await this.repo.softDelete(id, userId);
  }
}

// ── Controller + Routes ────────────────────────────────────────

const service = new PurchaseService();
const router: Router = Router();

router.use(
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  resolveTenant,
  requireTenant,
  requireFeature(FeatureCode.FEATURE_PURCHASES)
);

const handleListPurchases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const {
      page,
      limit,
      search,
      vendorId,
      categoryId,
      startDate,
      endDate,
      status,
      invoiceAvailable,
    } = req.query;
    const result = await service.list(
      authReq.tenantId,
      authReq.user.sub,
      authReq.user.role,
      Number(page),
      Number(limit),
      {
        search: search as string,
        vendorId: vendorId as string,
        categoryId: categoryId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        status: status as string,
        invoiceAvailable: invoiceAvailable !== undefined ? invoiceAvailable === 'true' : undefined,
      }
    );
    sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (e) {
    next(e);
  }
};

router.get('/', handleListPurchases);
router.get('/history', requireFeature(FeatureCode.FEATURE_PURCHASE_HISTORY), handleListPurchases);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const purchase = await service.getById(
      String(req.params.id),
      authReq.tenantId,
      authReq.user.sub,
      authReq.user.role
    );
    sendSuccess(res, purchase);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const dto = createPurchaseSchema.parse(req.body);
    const purchase = await service.create(authReq.tenantId, dto, authReq.user.sub);

    recordAuditLog({
      tenantId: authReq.tenantId,
      userId: authReq.user.sub,
      action: 'CREATE',
      entity: 'Purchase',
      entityId: purchase.id,
      newValues: {
        grandTotal: purchase.grandTotal,
        vendorId: purchase.vendorId,
        status: purchase.status,
      },
    });

    sendCreated(res, purchase, 'Purchase created successfully');
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const dto = updatePurchaseSchema.parse(req.body);
    const purchase = await service.update(
      String(req.params.id),
      authReq.tenantId,
      dto,
      authReq.user.sub,
      authReq.user.role
    );

    recordAuditLog({
      tenantId: authReq.tenantId,
      userId: authReq.user.sub,
      action: 'UPDATE',
      entity: 'Purchase',
      entityId: purchase.id,
      newValues: dto as Record<string, unknown>,
    });

    sendSuccess(res, purchase, 'Purchase updated');
  } catch (e) {
    next(e);
  }
});

router.delete(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = String(req.params.id);
      await service.delete(id, authReq.tenantId, authReq.user.sub, authReq.user.role);

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'DELETE',
        entity: 'Purchase',
        entityId: id,
      });

      sendSuccess(res, null, 'Purchase deleted');
    } catch (e) {
      next(e);
    }
  }
);

export { service as purchaseService };
export default router;
