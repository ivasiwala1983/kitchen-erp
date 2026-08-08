/**
 * Standardized API response helpers.
 */

import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): Response {
  return res.status(201).json({
    success: true,
    message,
    data,
  });
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
): Response {
  return res.status(200).json({
    success: true,
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
