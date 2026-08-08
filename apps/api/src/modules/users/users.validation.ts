/**
 * Users Module — Validation, Repository, Service, Controller, Routes
 * All in a single file for brevity — each is still logically isolated.
 */

// ── Validation ────────────────────────────────────────────────
import { z } from 'zod';
import { Role } from '@kitchen-erp/types';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/),
  name: z.string().min(2).max(100),
  role: z.nativeEnum(Role),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(Role).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
