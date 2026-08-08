/**
 * Purchase Module — Complete DDD Implementation
 * Handles the full purchase entry flow:
 *   Vendor → Items (Product, Qty, Rate, Total) → Grand Total → Invoice → Save
 */

import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../config/database';
import { parsePagination } from '@kitchen-erp/utils';
import { NotFoundError, ForbiddenError } from '../../shared/errors';
import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role, PurchaseStatus } from '@kitchen-erp/types';

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

// ── Repository ────────────────────────────────────────────────

class PurchaseRepository {
  async findAll(
    tenantId: string,
    params: {
      skip: number;
      take: number;
      search?: string;
      vendorId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    }
  ) {
    const where: any = {
      tenantId,
      deletedAt: null,
      ...(params.vendorId && { vendorId: params.vendorId }),
      ...(params.userId && { userId: params.userId }),
      ...(params.status && { status: params.status }),
      ...(params.startDate || params.endDate
        ? {
            purchaseDate: {
              ...(params.startDate && { gte: new Date(params.startDate) }),
              ...(params.endDate && { lte: new Date(params.endDate) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { purchaseDate: 'desc' },
        include: {
          vendor: { include: { category: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
          items: { include: { product: { include: { category: true } } } },
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string, tenantId: string) {
    return prisma.purchase.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vendor: { include: { category: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
        items: { include: { product: { include: { category: true } } } },
      },
    });
  }

  async create(data: {
    tenantId: string;
    vendorId: string;
    userId: string;
    grandTotal: Decimal;
    notes?: string;
    purchaseDate?: Date;
    status: string;
    createdBy: string;
    items: Array<{ productId: string; qty: Decimal; rate: Decimal; total: Decimal }>;
  }) {
    const { items, ...purchaseData } = data;
    return prisma.purchase.create({
      data: {
        ...purchaseData,
        status: purchaseData.status as any,
        updatedBy: data.createdBy,
        items: { create: items },
      },
      include: {
        vendor: { include: { category: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
        items: { include: { product: { include: { category: true } } } },
      },
    });
  }

  async update(
    id: string,
    data: {
      vendorId?: string;
      grandTotal?: Decimal;
      notes?: string;
      status?: string;
      invoiceUrl?: string;
      invoiceFid?: string;
      updatedBy: string;
    },
    newItems?: Array<{ productId: string; qty: Decimal; rate: Decimal; total: Decimal }>
  ) {
    return prisma.$transaction(async (tx) => {
      if (newItems) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchaseItem.createMany({
          data: newItems.map((item) => ({ purchaseId: id, ...item })),
        });
      }
      return tx.purchase.update({
        where: { id },
        data: { ...data, status: data.status as any },
        include: {
          vendor: { include: { category: true } },
          items: { include: { product: { include: { category: true } } } },
        },
      });
    });
  }

  async softDelete(id: string, deletedBy: string) {
    await prisma.purchase.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
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
    filters?: { vendorId?: string; startDate?: string; endDate?: string; status?: string }
  ) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { items, total } = await this.repo.findAll(tenantId, {
      skip,
      take: l,
      ...(userRole === Role.INVENTORY_MANAGER ? { userId } : {}),
      ...filters,
    });
    return { data: items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getById(id: string, tenantId: string, userId: string, userRole: Role) {
    const purchase = await this.repo.findById(id, tenantId);
    if (!purchase) throw new NotFoundError('Purchase not found');

    if (userRole === Role.INVENTORY_MANAGER && purchase.userId !== userId) {
      throw new ForbiddenError('Access denied');
    }

    return purchase;
  }

  async create(tenantId: string, dto: z.infer<typeof createPurchaseSchema>, userId: string) {
    const itemsWithTotals = dto.items.map((item) => ({
      productId: item.productId,
      qty: new Decimal(item.qty),
      rate: new Decimal(item.rate),
      total: new Decimal(item.qty * item.rate).toDecimalPlaces(2),
    }));

    const grandTotal = itemsWithTotals.reduce((sum, item) => sum.plus(item.total), new Decimal(0));

    return this.repo.create({
      tenantId,
      vendorId: dto.vendorId,
      userId,
      grandTotal,
      notes: dto.notes,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
      status: dto.status || PurchaseStatus.CONFIRMED,
      createdBy: userId,
      items: itemsWithTotals,
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

    let newItems;
    let grandTotal;

    if (dto.items) {
      newItems = dto.items.map((item) => ({
        productId: item.productId,
        qty: new Decimal(item.qty),
        rate: new Decimal(item.rate),
        total: new Decimal(item.qty * item.rate).toDecimalPlaces(2),
      }));
      grandTotal = newItems.reduce((sum, item) => sum.plus(item.total), new Decimal(0));
    }

    return this.repo.update(
      id,
      {
        ...(dto.vendorId && { vendorId: dto.vendorId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status && { status: dto.status }),
        ...(grandTotal && { grandTotal }),
        updatedBy: userId,
      },
      newItems
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
const router = Router();

router.use(
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  resolveTenant,
  requireTenant
);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, vendorId, startDate, endDate, status } = req.query;
    const result = await service.list(
      authReq.tenantId,
      authReq.user.sub,
      authReq.user.role,
      Number(page),
      Number(limit),
      {
        vendorId: vendorId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        status: status as string,
      }
    );
    sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (e) {
    next(e);
  }
});

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

import { recordAuditLog } from '../auditLog/auditLog.routes';

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
      newValues: dto as any,
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
