/**
 * Role-based authorization middleware factory.
 * Usage: authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../shared/errors';
import type { AuthenticatedRequest } from '../shared/types';
import type { Role } from '@kitchen-erp/types';

/**
 * Returns a middleware that restricts access to the given roles.
 * @param roles - Allowed roles. If empty, any authenticated user is allowed.
 */
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const userRole = authReq.user?.role;

    if (!userRole) {
      next(new ForbiddenError('User role not determined'));
      return;
    }

    if (roles.length > 0 && !roles.includes(userRole)) {
      next(
        new ForbiddenError(
          `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${userRole}`
        )
      );
      return;
    }

    next();
  };
}
