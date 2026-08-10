/**
 * Vendor Ledger Module — Routes & Controller
 * Consumes enterprise @kitchen-erp/database ledgerRepository & paymentRepository.
 */

import { z } from 'zod';
import { Router, Request, Response, NextFunction } from 'express';
import {
  ledgerRepository,
  paymentRepository,
  vendorRepository,
  LedgerTransactionType as DbLedgerTransactionType,
  PaymentMethod as DbPaymentMethod,
} from '@kitchen-erp/database';
import { parsePagination } from '@kitchen-erp/utils';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/response';
import { NotFoundError, BadRequestError } from '../../shared/errors';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role, PaymentMethod } from '@kitchen-erp/types';
import { recordAuditLog } from '../auditLog/auditLog.routes';

// ── Validation Schemas ─────────────────────────────────────────

const createPaymentSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor ID'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentDate: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference: z.string().max(255).optional(),
  note: z.string().max(1000).optional(),
});

// ── Service Layer ─────────────────────────────────────────────

class LedgerService {
  async getTenantSummary(tenantId: string) {
    return ledgerRepository.getTenantLedgerSummary(tenantId);
  }

  async getVendors(
    tenantId: string,
    page?: number,
    limit?: number,
    filters?: { search?: string; categoryId?: string; isActive?: boolean }
  ) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { items, total } = await ledgerRepository.findAllAccounts(tenantId, {
      skip,
      take: l,
      search: filters?.search,
      categoryId: filters?.categoryId,
      isActive: filters?.isActive,
    });
    return { data: items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getVendorDetail(tenantId: string, vendorId: string) {
    const detail = await ledgerRepository.findAccountByVendor(tenantId, vendorId);
    if (!detail) {
      throw new NotFoundError('Vendor not found for this tenant');
    }
    return detail;
  }

  async getVendorTransactions(
    tenantId: string,
    vendorId: string,
    page?: number,
    limit?: number,
    filters?: { type?: string; startDate?: string; endDate?: string }
  ) {
    const account = await ledgerRepository.findAccountByVendor(tenantId, vendorId);
    if (!account) {
      throw new NotFoundError('Vendor not found for this tenant');
    }

    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { items, total } = await ledgerRepository.findTransactions(tenantId, account.id, {
      skip,
      take: l,
      type: filters?.type as DbLedgerTransactionType,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });
    return { data: items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async listPayments(
    tenantId: string,
    page?: number,
    limit?: number,
    filters?: { vendorId?: string; paymentMethod?: string; startDate?: string; endDate?: string }
  ) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { items, total } = await paymentRepository.findAll(tenantId, {
      skip,
      take: l,
      vendorId: filters?.vendorId,
      paymentMethod: filters?.paymentMethod as DbPaymentMethod,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });
    return { data: items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async createPayment(tenantId: string, userId: string, dto: z.infer<typeof createPaymentSchema>) {
    // 1. Verify vendor exists, belongs to tenant, and is active
    const vendor = await vendorRepository.findById(dto.vendorId, tenantId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found for this tenant');
    }

    if (!vendor.isActive) {
      throw new BadRequestError('Cannot make payment to an inactive vendor');
    }

    // 2. Atomically create Payment & LedgerTransaction
    const { payment, currentBalance } = await paymentRepository.createPayment({
      tenantId,
      vendorId: dto.vendorId,
      amount: dto.amount,
      paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      paymentMethod: dto.paymentMethod as DbPaymentMethod,
      reference: dto.reference || null,
      note: dto.note || null,
      createdBy: userId,
    });

    return { payment, currentBalance };
  }

  async getPaymentById(tenantId: string, id: string) {
    const payment = await paymentRepository.findById(id, tenantId);
    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }
    return payment;
  }
}

// ── Router ────────────────────────────────────────────────────

const service = new LedgerService();
const router: Router = Router();

router.use(
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  resolveTenant,
  requireTenant
);

// GET /api/ledger/summary
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const summary = await service.getTenantSummary(authReq.tenantId);
    sendSuccess(res, summary);
  } catch (e) {
    next(e);
  }
});

// GET /api/ledger/vendors
router.get('/vendors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, search, categoryId, isActive } = req.query;
    const result = await service.getVendors(authReq.tenantId, Number(page), Number(limit), {
      search: search as string,
      categoryId: categoryId as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (e) {
    next(e);
  }
});

// GET /api/ledger/vendors/:vendorId
router.get('/vendors/:vendorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const detail = await service.getVendorDetail(authReq.tenantId, String(req.params.vendorId));
    sendSuccess(res, detail);
  } catch (e) {
    next(e);
  }
});

// GET /api/ledger/vendors/:vendorId/transactions
router.get(
  '/vendors/:vendorId/transactions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { page, limit, type, startDate, endDate } = req.query;
      const result = await service.getVendorTransactions(
        authReq.tenantId,
        String(req.params.vendorId),
        Number(page),
        Number(limit),
        {
          type: type as string,
          startDate: startDate as string,
          endDate: endDate as string,
        }
      );
      sendPaginated(res, result.data, result.total, result.page, result.limit);
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/ledger/payments
router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, vendorId, paymentMethod, startDate, endDate } = req.query;
    const result = await service.listPayments(authReq.tenantId, Number(page), Number(limit), {
      vendorId: vendorId as string,
      paymentMethod: paymentMethod as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (e) {
    next(e);
  }
});

// POST /api/ledger/payments
router.post('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const dto = createPaymentSchema.parse(req.body);
    const result = await service.createPayment(authReq.tenantId, authReq.user.sub, dto);

    recordAuditLog({
      tenantId: authReq.tenantId,
      userId: authReq.user.sub,
      action: 'PAYMENT_CREATED',
      entity: 'VendorPayment',
      entityId: result.payment.id,
      newValues: {
        vendorId: dto.vendorId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        currentBalance: result.currentBalance,
      },
    });

    sendCreated(res, result, 'Vendor payment recorded successfully');
  } catch (e) {
    next(e);
  }
});

// GET /api/ledger/payments/:id
router.get('/payments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const payment = await service.getPaymentById(authReq.tenantId, String(req.params.id));
    sendSuccess(res, payment);
  } catch (e) {
    next(e);
  }
});

export default router;
