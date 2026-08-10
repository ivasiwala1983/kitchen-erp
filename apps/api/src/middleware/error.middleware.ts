/**
 * Centralized error handling middleware.
 * Must be the last middleware registered in app.ts.
 * Preserves CORS headers on all error responses.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { config } from '../config/env';

function ensureCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  ensureCorsHeaders(req, res);

  // ── Zod Validation Errors ────────────────────────────────
  if (error instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    error.errors.forEach((e) => {
      const key = e.path.join('.');
      if (!errors[key]) errors[key] = [];
      errors[key].push(e.message);
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
    return;
  }

  // ── Known Application Errors ─────────────────────────────
  if (error instanceof AppError) {
    const errObj = error as { code?: string; feature?: string };
    res.status(error.statusCode).json({
      success: false,
      ...(errObj.code && { code: errObj.code }),
      ...(errObj.feature && { feature: errObj.feature }),
      message: error.message,
      errors: error.errors,
    });
    return;
  }

  // ── Prisma Errors ────────────────────────────────────────
  if (error instanceof Error && error.constructor.name.startsWith('Prisma')) {
    const prismaError = error as Error & { code?: string; meta?: Record<string, unknown> };

    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'A record with this value already exists',
        errors: { field: [String(prismaError.meta?.target || 'unknown')] },
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Record not found',
      });
      return;
    }
  }

  // ── Unknown Errors ────────────────────────────────────────
  console.error('Unhandled error:', error);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(config.isDev && { stack: error instanceof Error ? error.stack : String(error) }),
  });
}

/** 404 handler for unmatched routes */
export function notFoundHandler(req: Request, res: Response): void {
  ensureCorsHeaders(req, res);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}
