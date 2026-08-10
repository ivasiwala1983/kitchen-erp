/**
 * Feature Management Controller
 */

import { Request, Response, NextFunction } from 'express';
import { featureService } from './feature.service';
import { sendSuccess } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';
import { BadRequestError } from '../../shared/errors';

export async function getTenantFeatures(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = String(req.params.id || req.params.tenantId);
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }

    const features = await featureService.getTenantFeatureStates(tenantId);
    sendSuccess(res, features);
  } catch (error) {
    next(error);
  }
}

export async function updateTenantFeature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = String(req.params.id || req.params.tenantId);
    const { featureCode, enabled } = req.body;

    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }
    if (!featureCode || typeof featureCode !== 'string') {
      throw new BadRequestError('Valid featureCode is required');
    }
    if (enabled !== null && typeof enabled !== 'boolean') {
      throw new BadRequestError('Enabled property must be a boolean or null (reset to default)');
    }

    const superAdminUserId = authReq.user.sub;

    const result = await featureService.updateTenantFeatureOverride(
      tenantId,
      featureCode,
      enabled,
      superAdminUserId
    );

    // Return updated feature list
    const updatedFeatures = await featureService.getTenantFeatureStates(tenantId);
    sendSuccess(
      res,
      {
        updatedFeature: featureCode,
        overrideResult: result,
        features: updatedFeatures,
      },
      'Tenant feature entitlement updated successfully'
    );
  } catch (error) {
    next(error);
  }
}

export async function getEffectiveFeatures(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.tenantId;

    if (!tenantId) {
      sendSuccess(res, {});
      return;
    }

    const map = await featureService.getEffectiveFeaturesMap(tenantId);
    sendSuccess(res, map);
  } catch (error) {
    next(error);
  }
}
