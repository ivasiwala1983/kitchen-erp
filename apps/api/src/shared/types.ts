/**
 * Shared types for the API layer.
 * Extends Express types with authenticated request context.
 */

import { Request } from 'express';
import type { JwtPayload, Role } from '@kitchen-erp/types';

/** Authenticated request with decoded JWT payload and resolved tenant */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  tenantId: string; // resolved from JWT or X-Tenant-Slug header
}

/** Request context for service/repository layer */
export interface RequestContext {
  userId: string;
  tenantId: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}
