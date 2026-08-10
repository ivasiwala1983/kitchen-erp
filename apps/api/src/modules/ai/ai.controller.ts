/**
 * ArgusOne AI Controller
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../shared/response';
import { BadRequestError } from '../../shared/errors';
import type { AuthenticatedRequest } from '../../shared/types';
import { aiService } from './ai.service';
import { extractTenantSlug } from '../../middleware/tenant.middleware';

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

export async function chatController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = chatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new BadRequestError(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { message, history } = parseResult.data;

    const tenantSlug = extractTenantSlug(req) || req.user?.tenantSlug || undefined;

    const formattedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = (
      history || []
    ).map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content || '',
    }));

    const response = await aiService.chat(message, formattedHistory, {
      tenantId: req.tenantId,
      userId: req.user.userId || req.user.sub,
      role: req.user.role,
      tenantSlug,
      userName: req.user.name || req.user.email,
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
}
