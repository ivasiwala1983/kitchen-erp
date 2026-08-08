/**
 * Category Master Module — Validation Schemas
 */

import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  displayOrder: z.number().int().min(0).optional(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();
