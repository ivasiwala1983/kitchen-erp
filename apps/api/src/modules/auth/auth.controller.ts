/**
 * Auth Module — Controller
 * HTTP request handlers for authentication endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, refreshTokenSchema, changePasswordSchema } from './auth.validation';
import { sendSuccess } from '../../shared/response';
import type { AuthenticatedRequest } from '../../shared/types';

const service = new AuthService();

/**
 * POST /api/auth/login
 * Public — Login with email/password
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = loginSchema.parse(req.body);
    const result = await service.login(dto);
    sendSuccess(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 * Public — Refresh access token
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = refreshTokenSchema.parse(req.body);
    const tokens = await service.refreshToken(dto);
    sendSuccess(res, tokens, 'Token refreshed');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Protected — Get current user profile
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await service.getMe(authReq.user.sub);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/change-password
 * Protected — Change current user's password
 */
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const dto = changePasswordSchema.parse(req.body);
    await service.changePassword(authReq.user.sub, dto);
    sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * Protected — Client-side token invalidation (stateless JWT)
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, null, 'Logged out successfully');
}
