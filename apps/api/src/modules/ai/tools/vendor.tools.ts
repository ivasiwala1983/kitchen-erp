/**
 * Vendor Domain Read-Only AI Tools
 */

import { vendorRepository } from '@kitchen-erp/database';
import type { ToolDefinition } from '../guards/ai-read-only.guard';

export const vendorTools: ToolDefinition[] = [
  {
    name: 'getVendors',
    description:
      'Get list of active vendors for the tenant with optional search and category filter.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional search keyword' },
        categoryId: { type: 'string', description: 'Optional Category UUID filter' },
        isActive: { type: 'boolean', description: 'Filter by active status (default true)' },
        limit: { type: 'number', description: 'Max records (default 15)' },
      },
    },
    handler: async (params, context) => {
      const limit = Math.min(params.limit || 15, 30);
      const { items, total } = await vendorRepository.findAll(context.tenantId, {
        skip: 0,
        take: limit,
        search: params.search,
        categoryId: params.categoryId,
        isActive: params.isActive !== undefined ? params.isActive : true,
      });

      return {
        totalVendors: total,
        vendors: items.map((v) => ({
          id: v.id,
          name: v.name,
          categoryName: v.category?.name || 'Uncategorized',
          phone: v.phone || null,
          email: v.email || null,
          gst: v.gst || null,
          isActive: v.isActive,
        })),
      };
    },
  },
  {
    name: 'searchVendors',
    description: 'Search vendors by name, phone number, or GST number.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term for vendor lookup' },
      },
      required: ['search'],
    },
    handler: async (params, context) => {
      const { items, total } = await vendorRepository.findAll(context.tenantId, {
        skip: 0,
        take: 10,
        search: params.search,
      });

      return {
        totalMatches: total,
        vendors: items.map((v) => ({
          id: v.id,
          name: v.name,
          categoryName: v.category?.name,
          phone: v.phone,
        })),
      };
    },
  },
  {
    name: 'getVendorDetails',
    description: 'Get details of a specific vendor including category and contact info.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        vendorId: { type: 'string', description: 'Vendor UUID' },
      },
      required: ['vendorId'],
    },
    handler: async (params, context) => {
      const vendor = await vendorRepository.findById(params.vendorId, context.tenantId);
      if (!vendor) {
        return { found: false, message: 'Vendor not found for this tenant.' };
      }

      return {
        found: true,
        vendor: {
          id: vendor.id,
          name: vendor.name,
          categoryName: vendor.category?.name,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          gst: vendor.gst,
          isActive: vendor.isActive,
        },
      };
    },
  },
];
