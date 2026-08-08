/**
 * Authentication middleware.
 * Verifies JWT access token from Authorization header.
 * Attaches decoded payload to req.user.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../config/jwt';
import { UnauthorizedError } from '../shared/errors';
import type { AuthenticatedRequest } from '../shared/types';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Invalid authentication token format');
    }

    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = payload;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired authentication token'));
    }
  }
}
