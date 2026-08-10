/**
 * Report Domain Read-Only AI Tools
 */

import { reportRepository } from '@kitchen-erp/database';
import type { ToolDefinition } from '../guards/ai-read-only.guard';

export const reportTools: ToolDefinition[] = [
  {
    name: 'getPurchaseReport',
    description: 'Get analytical overview of tenant dashboard statistics and recent spend metrics.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async (_params, context) => {
      const stats = await reportRepository.getTenantDashboardStats(context.tenantId);
      return {
        totalPurchasesCount: stats.totalPurchases,
        totalSpendAmount: stats.totalSpend,
        totalVendorsCount: stats.totalVendors,
        totalProductsCount: stats.totalProducts,
        recentPurchases: stats.recentPurchases.map((p) => ({
          id: p.id,
          vendorName: p.vendor?.name,
          grandTotal: Number(p.grandTotal),
          purchaseDate: p.purchaseDate,
        })),
      };
    },
  },
  {
    name: 'getVendorReport',
    description: 'Get vendor counts and high-level dashboard metrics for the tenant.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async (_params, context) => {
      const stats = await reportRepository.getTenantDashboardStats(context.tenantId);
      return {
        totalActiveVendors: stats.totalVendors,
        totalActiveProducts: stats.totalProducts,
        totalSpend: stats.totalSpend,
      };
    },
  },
  {
    name: 'getTenantDashboardStats',
    description: 'Get overall dashboard statistics for the tenant.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async (_params, context) => {
      const stats = await reportRepository.getTenantDashboardStats(context.tenantId);
      return {
        totalPurchases: stats.totalPurchases,
        totalSpend: stats.totalSpend,
        totalVendors: stats.totalVendors,
        totalProducts: stats.totalProducts,
      };
    },
  },
];
