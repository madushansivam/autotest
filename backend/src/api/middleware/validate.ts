/**
 * api/middleware/validate.ts — Zod request validation helpers.
 *
 * Provides a factory function for creating Express middleware that
 * validates request bodies against a Zod schema and returns 400
 * with structured errors on failure.
 */

import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    // Attach parsed + typed body back to req
    (req as Request & { validatedBody: T }).validatedBody = result.data;
    next();
  };
}

// ── Shared request schemas ────────────────────────────────────────────────

export const createApplicationSchema = z.object({
  url: z.string().url('Must be a valid URL').max(2048),
  label: z.string().max(200).optional(),
});

export const createRunSchema = z.object({
  applicationId: z.string().uuid('applicationId must be a valid UUID'),
});
