/**
 * Tenant Isolation & Resolution Middleware.
 *
 * Resolves tenant context from:
 *  1. User JWT payload (req.user.tenantId) for TENANT_ADMIN and INVENTORY_MANAGER
 *  2. Subdomain / Host header (e.g. badri.localhost:3000 -> slug 'badri')
 *  3. X-Tenant-Slug header (e.g. 'badri')
 *  4. Fallback for SUPER_ADMIN to default active tenant if no tenant slug is provided.
 *
 * Enforces strict multi-tenant data isolation so tenant data never leaks across subdomains.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ForbiddenError, NotFoundError, BadRequestError } from '../shared/errors';
import type { AuthenticatedRequest } from '../shared/types';
import { Role } from '@kitchen-erp/types';

/**
 * Helper to extract tenant slug from request headers or subdomain host.
 * Supports: badri.localhost, badri.lvh.me, badri.kitchenerp.com, or X-Tenant-Slug header.
 */
export function extractTenantSlug(req: Request): string | undefined {
  // 1. Explicit X-Tenant-Slug header
  const headerSlug = req.headers['x-tenant-slug'] as string | undefined;
  if (headerSlug && headerSlug.trim()) {
    return headerSlug.trim().toLowerCase();
  }

  // 2. Extract from Origin header (e.g. http://badri.localhost:3000)
  const origin = req.headers['origin'] as string | undefined;
  if (origin) {
    try {
      const url = new URL(origin);
      const parts = url.hostname.split('.');
      if (parts.length > 1 && !['localhost', 'lvh', 'www', '127', '0'].includes(parts[0])) {
        return parts[0].toLowerCase();
      }
    } catch {
      // ignore URL parse error
    }
  }

  // 3. Extract from Referer header (e.g. http://badri.localhost:3000/dashboard)
  const referer = req.headers['referer'] as string | undefined;
  if (referer) {
    try {
      const url = new URL(referer);
      const parts = url.hostname.split('.');
      if (parts.length > 1 && !['localhost', 'lvh', 'www', '127', '0'].includes(parts[0])) {
        return parts[0].toLowerCase();
      }
    } catch {
      // ignore URL parse error
    }
  }

  // 4. Extract from Host header (e.g. badri.localhost:4000)
  const hostHeader = req.headers['host'] as string | undefined;
  if (hostHeader) {
    const hostname = hostHeader.split(':')[0];
    const parts = hostname.split('.');
    if (parts.length > 1 && !['localhost', 'lvh', 'www', '127', '0'].includes(parts[0])) {
      return parts[0].toLowerCase();
    }
  }

  return undefined;
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
        const tenant = await prisma.tenant.findUnique({
          where: { slug: extractedSlug, deletedAt: null },
        });
        if (tenant) {
          authReq.tenantId = tenant.id;
        } else {
          throw new NotFoundError(`Tenant with slug '${extractedSlug}' not found`);
        }
      } else {
        // Fallback for SUPER_ADMIN to default active tenant when no slug header is supplied
        const defaultTenant = await prisma.tenant.findFirst({
          where: { deletedAt: null, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (defaultTenant) {
          authReq.tenantId = defaultTenant.id;
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
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new ForbiddenError('Tenant is deactivated. Contact support.');
    }

    // If subdomain specifies a different tenant, enforce cross-tenant protection!
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
        'Tenant context required for this operation. Specify tenant subdomain or X-Tenant-Slug header.'
      )
    );
    return;
  }
  next();
}
