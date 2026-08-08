/**
 * Tenant Module — Validation Schemas (Zod)
 */

import { z } from 'zod';
import { TenantPlan } from '@kitchen-erp/types';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  domain: z.string().optional(),
  plan: z.nativeEnum(TenantPlan).default(TenantPlan.BASIC),
  currency: z.string().default('INR'),
  adminEmail: z.string().email('Invalid admin email'),
  adminName: z.string().min(2, 'Admin name must be at least 2 characters').max(100),
  adminPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must have uppercase')
    .regex(/[a-z]/, 'Must have lowercase')
    .regex(/\d/, 'Must have digit'),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  domain: z.string().nullable().optional(),
  plan: z.nativeEnum(TenantPlan).optional(),
  currency: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
