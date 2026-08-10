/**
 * Product Domain Read-Only AI Tools
 */

import { productRepository } from '@kitchen-erp/database';
import type { ToolDefinition } from '../guards/ai-read-only.guard';

export const productTools: ToolDefinition[] = [
  {
    name: 'getProducts',
    description:
      'Get catalog of products for the tenant with optional search and category filters.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional search keyword' },
        categoryId: { type: 'string', description: 'Optional Category UUID' },
        isActive: { type: 'boolean', description: 'Active filter (default true)' },
        limit: { type: 'number', description: 'Max items to return (default 20)' },
      },
    },
    handler: async (params, context) => {
      const limit = Math.min(params.limit || 20, 50);
      const { items, total } = await productRepository.findAll(context.tenantId, {
        skip: 0,
        take: limit,
        search: params.search,
        categoryId: params.categoryId,
        isActive: params.isActive !== undefined ? params.isActive : true,
      });

      return {
        totalProducts: total,
        products: items.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          categoryName: p.category?.name || 'Uncategorized',
          isActive: p.isActive,
        })),
      };
    },
  },
  {
    name: 'searchProducts',
    description: 'Search products by name.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term for product name' },
      },
      required: ['search'],
    },
    handler: async (params, context) => {
      const { items, total } = await productRepository.findAll(context.tenantId, {
        skip: 0,
        take: 10,
        search: params.search,
      });

      return {
        totalMatches: total,
        products: items.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          categoryName: p.category?.name,
        })),
      };
    },
  },
  {
    name: 'getProductDetails',
    description: 'Get product details by product ID.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product UUID' },
      },
      required: ['productId'],
    },
    handler: async (params, context) => {
      const product = await productRepository.findById(params.productId, context.tenantId);
      if (!product) {
        return { found: false, message: 'Product not found for this tenant.' };
      }

      return {
        found: true,
        product: {
          id: product.id,
          name: product.name,
          unit: product.unit,
          categoryName: product.category?.name,
          isActive: product.isActive,
        },
      };
    },
  },
];
