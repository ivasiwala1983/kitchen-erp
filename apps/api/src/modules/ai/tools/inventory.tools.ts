/**
 * Inventory Domain Read-Only AI Tools
 */

import { productRepository, purchaseRepository } from '@kitchen-erp/database';
import type { ToolDefinition } from '../guards/ai-read-only.guard';

export const inventoryTools: ToolDefinition[] = [
  {
    name: 'getLowStockItems',
    description:
      'Identify items that have low purchasing frequency or attention indicators based on recent purchase logs.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional product search keyword' },
      },
    },
    handler: async (params, context) => {
      // Retrieve product catalog and recent purchase item history
      const { items: products } = await productRepository.findAll(context.tenantId, {
        skip: 0,
        take: 50,
        search: params.search,
        isActive: true,
      });

      const { items: recentPurchases } = await purchaseRepository.findAll(context.tenantId, {
        skip: 0,
        take: 30,
      });

      // Track recent product purchase dates
      const productLastPurchased: Record<string, { date: Date; qty: number; unit: string }> = {};

      for (const p of recentPurchases) {
        // Find purchase detail for item dates
        const pDetail = await purchaseRepository.findById(p.id, context.tenantId);
        if (pDetail?.items) {
          for (const item of pDetail.items) {
            const pId = item.productId;
            if (
              !productLastPurchased[pId] ||
              new Date(pDetail.purchaseDate) > productLastPurchased[pId].date
            ) {
              productLastPurchased[pId] = {
                date: new Date(pDetail.purchaseDate),
                qty: Number(item.qty),
                unit: item.product?.unit || 'unit',
              };
            }
          }
        }
      }

      const itemsNeedingAttention = products.map((prod) => {
        const lastP = productLastPurchased[prod.id];
        return {
          id: prod.id,
          productName: prod.name,
          categoryName: prod.category?.name || 'Uncategorized',
          unit: prod.unit,
          lastPurchasedDate: lastP ? lastP.date.toISOString().split('T')[0] : 'No recent purchases',
          lastQty: lastP ? lastP.qty : 0,
        };
      });

      return {
        totalProductsAnalyzed: products.length,
        itemsSummary: itemsNeedingAttention.slice(0, 15),
      };
    },
  },
  {
    name: 'getInventorySummary',
    description: 'Get total product count and category distribution summary.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', description: 'Optional Category UUID filter' },
      },
    },
    handler: async (params, context) => {
      const { items, total } = await productRepository.findAll(context.tenantId, {
        skip: 0,
        take: 100,
        categoryId: params.categoryId,
        isActive: true,
      });

      const categoryMap: Record<string, number> = {};
      for (const prod of items) {
        const catName = prod.category?.name || 'Uncategorized';
        categoryMap[catName] = (categoryMap[catName] || 0) + 1;
      }

      return {
        totalActiveProducts: total,
        categoryBreakdown: Object.entries(categoryMap).map(([category, count]) => ({
          category,
          productCount: count,
        })),
      };
    },
  },
];
