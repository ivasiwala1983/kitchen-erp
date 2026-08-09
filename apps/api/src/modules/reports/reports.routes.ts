/**
 * Reports Module — Analytics and reporting endpoints.
 * Consumes enterprise @kitchen-erp/database ReportRepository.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@kitchen-erp/database';
import { sendSuccess } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { Role } from '@kitchen-erp/types';

const router: Router = Router();

// ── Platform Overview Report (SUPER_ADMIN only) ──────────────────────────────
router.get(
  '/platform',
  authenticate,
  authorize(Role.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, tenantId, vendorId } = req.query;

      const purchaseWhere: Record<string, unknown> = { deletedAt: null };
      if (tenantId && String(tenantId).trim()) {
        purchaseWhere.tenantId = String(tenantId).trim();
      }
      if (vendorId && String(vendorId).trim()) {
        purchaseWhere.vendorId = String(vendorId).trim();
      }
      if (startDate || endDate) {
        purchaseWhere.purchaseDate = {
          ...(startDate ? { gte: new Date(String(startDate) + 'T00:00:00.000Z') } : {}),
          ...(endDate ? { lte: new Date(String(endDate) + 'T23:59:59.999Z') } : {}),
        };
      }

      const [
        tenants,
        totalPurchases,
        totalUsers,
        totalVendors,
        totalProducts,
        purchaseAgg,
        filteredPurchases,
        allVendorsList,
      ] = await Promise.all([
        prisma.tenant.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                users: true,
                vendors: true,
                products: true,
                purchases: true,
              },
            },
          },
        }),
        prisma.purchase.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.vendor.count({ where: { deletedAt: null } }),
        prisma.product.count({ where: { deletedAt: null } }),
        prisma.purchase.aggregate({
          where: purchaseWhere,
          _sum: { grandTotal: true },
        }),
        prisma.purchase.findMany({
          where: purchaseWhere,
          take: 200,
          orderBy: { purchaseDate: 'desc' },
          include: {
            tenant: { select: { id: true, name: true, slug: true, currency: true } },
            vendor: { include: { category: true } },
            user: { select: { id: true, name: true, email: true } },
            items: { include: { product: true } },
          },
        }),
        prisma.vendor.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            tenantId: true,
            category: { select: { id: true, name: true } },
          },
          orderBy: { name: 'asc' },
        }),
      ]);

      const spendByTenant = await prisma.purchase.groupBy({
        by: ['tenantId'],
        where: { deletedAt: null },
        _sum: { grandTotal: true },
        _count: { id: true },
      });

      const spendMap = new Map(
        spendByTenant.map((s) => [
          s.tenantId,
          { spend: Number(s._sum.grandTotal || 0), count: s._count.id },
        ])
      );

      const tenantBreakdown = tenants.map((t) => {
        const spendInfo = spendMap.get(t.id) || { spend: 0, count: 0 };
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          plan: t.plan,
          currency: t.currency || 'INR',
          isActive: t.isActive,
          createdAt: t.createdAt.toISOString(),
          userCount: t._count.users,
          vendorCount: t._count.vendors,
          productCount: t._count.products,
          purchaseCount: t._count.purchases,
          totalSpend: spendInfo.spend,
        };
      });

      const formattedInvoices = filteredPurchases.map((p) => ({
        id: p.id,
        purchaseDate: p.purchaseDate ? p.purchaseDate.toISOString() : p.createdAt.toISOString(),
        tenantId: p.tenantId,
        tenantName: p.tenant?.name || 'Unknown Tenant',
        currency: p.tenant?.currency || 'INR',
        vendorId: p.vendorId,
        vendorName: p.vendor?.name || 'Unknown Vendor',
        categoryName: p.vendor?.category?.name || 'General',
        userName: p.user?.name || 'Manager',
        userEmail: p.user?.email || '',
        itemCount: p.items?.length || 0,
        grandTotal: Number(p.grandTotal),
        status: p.status,
        notes: p.notes,
        invoiceUrl: p.invoiceUrl,
        items: p.items.map((i) => ({
          id: i.id,
          productName: i.product?.name || 'Item',
          qty: Number(i.qty),
          rate: Number(i.rate),
          total: Number(i.total),
          unit: i.product?.unit || 'unit',
        })),
      }));

      return sendSuccess(res, {
        totalTenants: tenants.length,
        activeTenants: tenants.filter((t) => t.isActive).length,
        totalUsers,
        totalVendors,
        totalProducts,
        totalPurchases,
        totalPlatformSpend: Number(purchaseAgg._sum.grandTotal || 0),
        tenantsBreakdown: tenantBreakdown,
        tenantsList: tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
        vendorsList: allVendorsList.map((v) => ({
          id: v.id,
          name: v.name,
          tenantId: v.tenantId,
          categoryName: v.category?.name,
        })),
        invoices: formattedInvoices,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.use(
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
  resolveTenant,
  requireTenant
);

// ── Validation ────────────────────────────────────────────────

const reportFilterSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  vendorId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

function getDateRange(startDate: string, endDate: string) {
  return {
    gte: new Date(startDate + 'T00:00:00.000Z'),
    lte: new Date(endDate + 'T23:59:59.999Z'),
  };
}

// ── Daily Report ──────────────────────────────────────────────

router.get('/daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { startDate, endDate } = reportFilterSchema.parse(req.query);

    const purchases = await prisma.purchase.findMany({
      where: {
        tenantId: authReq.tenantId,
        deletedAt: null,
        status: 'CONFIRMED',
        purchaseDate: getDateRange(startDate, endDate),
      },
      select: { purchaseDate: true, grandTotal: true },
      orderBy: { purchaseDate: 'asc' },
    });

    const grouped: Record<string, { date: string; totalPurchases: number; totalAmount: number }> =
      {};
    for (const p of purchases) {
      const dateKey = p.purchaseDate.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, totalPurchases: 0, totalAmount: 0 };
      }
      grouped[dateKey].totalPurchases += 1;
      grouped[dateKey].totalAmount = parseFloat(
        (grouped[dateKey].totalAmount + parseFloat(p.grandTotal.toString())).toFixed(2)
      );
    }

    sendSuccess(res, Object.values(grouped));
  } catch (e) {
    next(e);
  }
});

// ── Monthly Report ────────────────────────────────────────────

router.get('/monthly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { startDate, endDate } = reportFilterSchema.parse(req.query);

    const purchases = await prisma.purchase.findMany({
      where: {
        tenantId: authReq.tenantId,
        deletedAt: null,
        status: 'CONFIRMED',
        purchaseDate: getDateRange(startDate, endDate),
      },
      select: { purchaseDate: true, grandTotal: true },
      orderBy: { purchaseDate: 'asc' },
    });

    const grouped: Record<string, { date: string; totalPurchases: number; totalAmount: number }> =
      {};
    for (const p of purchases) {
      const d = p.purchaseDate;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = { date: monthKey, totalPurchases: 0, totalAmount: 0 };
      }
      grouped[monthKey].totalPurchases += 1;
      grouped[monthKey].totalAmount = parseFloat(
        (grouped[monthKey].totalAmount + parseFloat(p.grandTotal.toString())).toFixed(2)
      );
    }

    sendSuccess(res, Object.values(grouped));
  } catch (e) {
    next(e);
  }
});

// ── Vendor Report ─────────────────────────────────────────────

router.get('/vendor', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { startDate, endDate } = reportFilterSchema.parse(req.query);

    const result = await prisma.purchase.groupBy({
      by: ['vendorId'],
      where: {
        tenantId: authReq.tenantId,
        deletedAt: null,
        status: 'CONFIRMED',
        purchaseDate: getDateRange(startDate, endDate),
      },
      _count: { id: true },
      _sum: { grandTotal: true },
    });

    const vendorIds = result.map((r) => r.vendorId);
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true },
    });
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

    const data = result.map((r) => ({
      vendorId: r.vendorId,
      vendorName: vendorMap[r.vendorId] || 'Unknown',
      totalPurchases: r._count.id,
      totalAmount: parseFloat(r._sum.grandTotal?.toString() || '0'),
    }));

    sendSuccess(
      res,
      data.sort((a, b) => b.totalAmount - a.totalAmount)
    );
  } catch (e) {
    next(e);
  }
});

// ── Category Report ───────────────────────────────────────────

router.get('/category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { startDate, endDate } = reportFilterSchema.parse(req.query);

    const purchases = await prisma.purchase.findMany({
      where: {
        tenantId: authReq.tenantId,
        deletedAt: null,
        status: 'CONFIRMED',
        purchaseDate: getDateRange(startDate, endDate),
      },
      include: {
        vendor: { include: { category: true } },
      },
    });

    const grouped: Record<
      string,
      { categoryId: string; categoryName: string; totalPurchases: number; totalAmount: number }
    > = {};

    for (const p of purchases) {
      const catId = p.vendor.categoryId;
      const catName = p.vendor.category.name;
      if (!grouped[catId]) {
        grouped[catId] = {
          categoryId: catId,
          categoryName: catName,
          totalPurchases: 0,
          totalAmount: 0,
        };
      }
      grouped[catId].totalPurchases += 1;
      grouped[catId].totalAmount = parseFloat(
        (grouped[catId].totalAmount + parseFloat(p.grandTotal.toString())).toFixed(2)
      );
    }

    sendSuccess(
      res,
      Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount)
    );
  } catch (e) {
    next(e);
  }
});

// ── Product Report ────────────────────────────────────────────

router.get('/product', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { startDate, endDate } = reportFilterSchema.parse(req.query);

    const items = await prisma.purchaseItem.findMany({
      where: {
        purchase: {
          tenantId: authReq.tenantId,
          deletedAt: null,
          status: 'CONFIRMED',
          purchaseDate: getDateRange(startDate, endDate),
        },
      },
      include: { product: true },
    });

    const grouped: Record<
      string,
      {
        productId: string;
        productName: string;
        unit: string;
        totalQty: number;
        totalAmount: number;
      }
    > = {};

    for (const item of items) {
      const pid = item.productId;
      if (!grouped[pid]) {
        grouped[pid] = {
          productId: pid,
          productName: item.product.name,
          unit: item.product.unit,
          totalQty: 0,
          totalAmount: 0,
        };
      }
      grouped[pid].totalQty = parseFloat(
        (grouped[pid].totalQty + parseFloat(item.qty.toString())).toFixed(3)
      );
      grouped[pid].totalAmount = parseFloat(
        (grouped[pid].totalAmount + parseFloat(item.total.toString())).toFixed(2)
      );
    }

    sendSuccess(
      res,
      Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount)
    );
  } catch (e) {
    next(e);
  }
});

// ── Manager Report ────────────────────────────────────────────

router.get('/manager', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { startDate, endDate } = reportFilterSchema.parse(req.query);

    const result = await prisma.purchase.groupBy({
      by: ['userId'],
      where: {
        tenantId: authReq.tenantId,
        deletedAt: null,
        status: 'CONFIRMED',
        purchaseDate: getDateRange(startDate, endDate),
      },
      _count: { id: true },
      _sum: { grandTotal: true },
    });

    const userIds = result.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const data = result.map((r) => ({
      userId: r.userId,
      userName: userMap[r.userId] || 'Unknown',
      totalPurchases: r._count.id,
      totalAmount: parseFloat(r._sum.grandTotal?.toString() || '0'),
    }));

    sendSuccess(
      res,
      data.sort((a, b) => b.totalPurchases - a.totalPurchases)
    );
  } catch (e) {
    next(e);
  }
});

export default router;
