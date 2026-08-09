/**
 * Authentication middleware.
 * Verifies JWT access token from Authorization header or URL query parameter (?token=...).
 * Attaches decoded payload to req.user.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../config/jwt';
import { UnauthorizedError } from '../shared/errors';
import type { AuthenticatedRequest } from '../shared/types';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    } else if (req.query.accessToken && typeof req.query.accessToken === 'string') {
      token = req.query.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
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
