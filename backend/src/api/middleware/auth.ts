/**
 * api/middleware/auth.ts — Supabase JWT verification middleware.
 *
 * Verifies the Authorization: Bearer <token> header by calling the
 * Supabase admin client's getUser() method, which validates the JWT
 * signature against the project's public key.
 *
 * On success, attaches the verified userId to req.userId so downstream
 * route handlers can use it without re-verifying.
 */

import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../lib/supabase-server';

// Extend Express Request to carry the verified user ID
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error) console.error('Supabase getUser error:', error.message, error.status);

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  req.userId = data.user.id;
  next();
  } catch (err) {
  console.error('Auth verification error:', err);
  res.status(401).json({ error: 'Token verification failed.' });
  }
}
