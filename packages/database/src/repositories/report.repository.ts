/**
 * ReportRepository
 * Encapsulates analytical reporting queries across Purchases, Products, Vendors, and Tenants.
 */

import { Prisma } from '../generated/client';
import { prisma } from '../client/prisma';

export class ReportRepository {
  async getSuperAdminOverview() {
    const [
      tenantsCount,
      activeTenantsCount,
      purchasesCount,
      usersCount,
      vendorsCount,
      productsCount,
      grandTotalAggregate,
      recentPurchases,
      topVendors,
    ] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({ where: { isActive: true, deletedAt: null } }),
      prisma.purchase.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.vendor.count({ where: { deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.purchase.aggregate({
        _sum: { grandTotal: true },
        where: { deletedAt: null },
      }),
      prisma.purchase.findMany({
        take: 5,
        orderBy: { purchaseDate: 'desc' },
        where: { deletedAt: null },
        include: {
          tenant: { select: { name: true, slug: true } },
          vendor: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.vendor.findMany({
        take: 5,
        where: { deletedAt: null },
        include: {
          tenant: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
    ]);

    const spendByTenantGroup = await prisma.purchase.groupBy({
      by: ['tenantId'],
      _sum: { grandTotal: true },
      _count: { id: true },
      where: { deletedAt: null },
    });

    const tenantIds = spendByTenantGroup.map((g) => g.tenantId);
    const tenantDetails = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true },
    });

    const tenantMap = new Map(tenantDetails.map((t) => [t.id, t]));

    const spendByTenant = spendByTenantGroup.map((g) => ({
      tenantId: g.tenantId,
      tenantName: tenantMap.get(g.tenantId)?.name || 'Unknown',
      tenantSlug: tenantMap.get(g.tenantId)?.slug || '',
      totalSpend: Number(g._sum.grandTotal || 0),
      purchaseCount: g._count.id,
    }));

    return {
      tenantsCount,
      activeTenantsCount,
      purchasesCount,
      usersCount,
      vendorsCount,
      productsCount,
      totalPlatformSpend: Number(grandTotalAggregate._sum.grandTotal || 0),
      recentPurchases,
      topVendors,
      spendByTenant,
    };
  }

  async getTenantDashboardStats(tenantId: string) {
    const [totalPurchases, totalSpend, totalVendors, totalProducts, recentPurchases] =
      await Promise.all([
        prisma.purchase.count({ where: { tenantId, deletedAt: null } }),
        prisma.purchase.aggregate({
          where: { tenantId, deletedAt: null },
          _sum: { grandTotal: true },
        }),
        prisma.vendor.count({ where: { tenantId, deletedAt: null, isActive: true } }),
        prisma.product.count({ where: { tenantId, deletedAt: null, isActive: true } }),
        prisma.purchase.findMany({
          where: { tenantId, deletedAt: null },
          take: 5,
          orderBy: { purchaseDate: 'desc' },
          include: {
            vendor: { select: { name: true } },
            user: { select: { name: true } },
          },
        }),
      ]);

    return {
      totalPurchases,
      totalSpend: Number(totalSpend._sum.grandTotal || 0),
      totalVendors,
      totalProducts,
      recentPurchases,
    };
  }
}

export const reportRepository = new ReportRepository();
