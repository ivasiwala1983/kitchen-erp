/**
 * Vendor Module — Validation
 */

import { z } from 'zod';

export const createVendorSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().min(2, 'Vendor name must be at least 2 characters').max(100),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  address: z.string().max(500).optional().nullable(),
  gst: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
