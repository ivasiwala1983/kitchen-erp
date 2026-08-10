/**
 * Centralized Feature Guard Middleware
 * Enforces tenant feature entitlements on API routes.
 */

import { Request, Response, NextFunction } from 'express';
import { featureService } from '../modules/feature/feature.service';
import { FeatureDisabledError } from '../shared/errors';
import type { AuthenticatedRequest } from '../shared/types';
import { Role } from '@kitchen-erp/types';

export function requireFeature(featureCode: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.tenantId;

      // If no tenant context is attached:
      // Super Admin operating globally outside tenant context can bypass tenant feature check,
      // but if user is authenticated with a tenantId, feature check MUST be enforced.
      if (!tenantId) {
        if (authReq.user?.role === Role.SUPER_ADMIN) {
          next();
          return;
        }
        throw new FeatureDisabledError(featureCode);
      }

      const enabled = await featureService.isFeatureEnabled(tenantId, featureCode);

      if (!enabled) {
        throw new FeatureDisabledError(featureCode);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
