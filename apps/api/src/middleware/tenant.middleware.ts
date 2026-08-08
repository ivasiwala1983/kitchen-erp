/**
 * Tenant Isolation & Resolution Middleware.
 * Consumes TenantResolver and tenantRepository from @kitchen-erp/database.
 */

import { Request, Response, NextFunction } from 'express';
import { tenantRepository } from '@kitchen-erp/database';
import { config } from '../config/env';
import { ForbiddenError, NotFoundError, BadRequestError } from '../shared/errors';
import type { AuthenticatedRequest } from '../shared/types';
import { Role } from '@kitchen-erp/types';
import { TenantResolver } from '@kitchen-erp/utils';

/**
 * Helper to extract tenant slug from request using TenantResolver.
 */
export function extractTenantSlug(req: Request): string | undefined {
  const authReq = req as AuthenticatedRequest;
  return TenantResolver.resolveTenantSlug({
    path: req.originalUrl || req.url || req.path,
    host: req.headers['host'],
    originOrReferer: (req.headers['origin'] || req.headers['referer']) as string,
    headerSlug: req.headers['x-tenant-slug'] as string,
    mode: config.tenantMode,
    jwtTenantSlug: authReq.user?.tenantSlug || undefined,
  });
}

export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    const extractedSlug = extractTenantSlug(req);

    // 1. SUPER_ADMIN Role
    if (user.role === Role.SUPER_ADMIN) {
      if (extractedSlug) {
        const tenant = await tenantRepository.findBySlug(extractedSlug);
        if (tenant) {
          authReq.tenantId = tenant.id;
        } else {
          throw new NotFoundError(`Tenant with slug '${extractedSlug}' not found`);
        }
      } else {
        // Fallback for SUPER_ADMIN to first active tenant
        const publicTenants = await tenantRepository.findActivePublic();
        if (publicTenants.length > 0) {
          authReq.tenantId = publicTenants[0].id;
        }
      }
      next();
      return;
    }

    // 2. TENANT_ADMIN & INVENTORY_MANAGER Roles
    if (!user.tenantId) {
      throw new ForbiddenError('No tenant associated with this account');
    }

    // Verify user's assigned tenant exists and is active
    const tenant = await tenantRepository.findById(user.tenantId);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new ForbiddenError('Tenant is deactivated. Contact support.');
    }

    // If request specifies a different tenant slug, enforce cross-tenant protection!
    if (extractedSlug && tenant.slug !== extractedSlug) {
      throw new ForbiddenError(
        `Access denied: Your account belongs to '${tenant.slug}', not '${extractedSlug}'.`
      );
    }

    authReq.tenantId = tenant.id;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Strict tenant guard — ensures tenantId is non-empty for tenant data operations.
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.tenantId) {
    next(
      new BadRequestError(
        'Tenant context required for this operation. Specify tenant URL path (/t/slug) or X-Tenant-Slug header.'
      )
    );
    return;
  }
  next();
}
