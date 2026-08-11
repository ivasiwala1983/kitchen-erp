/**
 * Purchase Domain Read-Only AI Tools
 */

import { purchaseRepository } from '@kitchen-erp/database';
import type { ToolDefinition } from '../guards/ai-read-only.guard';

export const purchaseTools: ToolDefinition[] = [
  {
    name: 'getPurchaseSummary',
    description:
      'Get aggregated summary of purchases for the authenticated tenant within an optional date range or vendor filter.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)' },
        vendorId: { type: 'string', description: 'Optional Vendor UUID filter' },
        categoryId: { type: 'string', description: 'Optional Category UUID filter' },
      },
    },
    handler: async (params, context) => {
      const { items, total } = await purchaseRepository.findAll(context.tenantId, {
        skip: 0,
        take: 100,
        startDate: params.startDate,
        endDate: params.endDate,
        vendorId: params.vendorId,
        categoryId: params.categoryId,
      });

      const totalSpend = items.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
      const avgOrderValue = total > 0 ? totalSpend / total : 0;

      // Group spend by vendor
      const vendorSpendMap: Record<string, { name: string; total: number; count: number }> = {};
      for (const item of items) {
        const vName = item.vendor?.name || 'Unknown Vendor';
        if (!vendorSpendMap[vName]) {
          vendorSpendMap[vName] = { name: vName, total: 0, count: 0 };
        }
        vendorSpendMap[vName].total += Number(item.grandTotal || 0);
        vendorSpendMap[vName].count += 1;
      }

      const topVendors = Object.values(vendorSpendMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      return {
        purchaseCount: total,
        totalSpend,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        topVendorsBySpend: topVendors,
        period: { startDate: params.startDate || 'all-time', endDate: params.endDate || 'now' },
      };
    },
  },
  {
    name: 'searchPurchases',
    description: 'Search purchase records by keyword, vendor name, or invoice number.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term or vendor name' },
        limit: { type: 'number', description: 'Maximum number of items to return (default 10)' },
      },
    },
    handler: async (params, context) => {
      const limit = Math.min(params.limit || 10, 20);
      const { items, total } = await purchaseRepository.findAll(context.tenantId, {
        skip: 0,
        take: limit,
        search: params.search,
      });

      return {
        totalMatches: total,
        purchases: items.map((p) => ({
          id: p.id,
          vendorName: p.vendor?.name || 'Unknown',
          categoryName: p.category?.name || p.vendor?.category?.name || 'Unknown',
          purchaseType: p.purchaseType || (p.vendor?.category?.type ?? 'PRODUCT'),
          billMonth: p.billMonth || null,
          billAmount: p.billAmount ? Number(p.billAmount) : null,
          purchaseDate: p.purchaseDate,
          grandTotal: Number(p.grandTotal),
          status: p.status,
          notes: p.notes || null,
        })),
      };
    },
  },
  {
    name: 'getPurchaseDetails',
    description: 'Get full line-item details of a specific purchase record by ID.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        purchaseId: { type: 'string', description: 'Purchase UUID' },
      },
      required: ['purchaseId'],
    },
    handler: async (params, context) => {
      const purchase = await purchaseRepository.findById(params.purchaseId, context.tenantId);
      if (!purchase) {
        return { found: false, message: 'Purchase record not found for this tenant.' };
      }

      return {
        found: true,
        purchase: {
          id: purchase.id,
          vendorName: purchase.vendor?.name,
          categoryName: purchase.category?.name || purchase.vendor?.category?.name,
          purchaseType: purchase.purchaseType,
          billMonth: purchase.billMonth,
          billAmount: purchase.billAmount ? Number(purchase.billAmount) : null,
          purchaseDate: purchase.purchaseDate,
          grandTotal: Number(purchase.grandTotal),
          status: purchase.status,
          notes: purchase.notes,
          items: purchase.items.map((item) => ({
            productName: item.product?.name,
            qty: Number(item.qty),
            rate: Number(item.rate),
            total: Number(item.total),
          })),
        },
      };
    },
  },
];
