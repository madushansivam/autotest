/**
 * rate-limiter.ts — Per-user sliding-window rate limiter.
 *
 * Keyed on Supabase user_id (stable, auth-verified identifier).
 * In-memory implementation suitable for single-process deployment.
 * For multi-process deployments (Railway, Fly.io with multiple
 * instances), replace the in-memory store with a Redis-backed
 * implementation using ioredis.
 */
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

interface WindowEntry {
  timestamps: number[];
}

// In-memory store: userId → list of request timestamps in the current window
const store = new Map<string, WindowEntry>();

// Clean up stale entries every 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - config.RATE_LIMIT_WINDOW_MS;
  for (const [userId, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(userId);
    }
  }
}, 10 * 60 * 1000);

/**
 * Express middleware. Applies the per-user run rate limit.
 * Must be used AFTER the auth middleware so req.userId is populated.
 */
export function runRateLimiter(
  req: Request & { userId?: string },
  res: Response,
  next: NextFunction
): void {
  const userId = req.userId;
  if (!userId) {
    // Auth middleware should have already rejected unauthenticated requests;
    // this is a defensive fallback.
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const now = Date.now();
  const windowStart = now - config.RATE_LIMIT_WINDOW_MS;

  const entry = store.get(userId) ?? { timestamps: [] };
  // Slide the window: remove timestamps older than the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.RATE_LIMIT_MAX_RUNS) {
    const oldestInWindow = entry.timestamps[0];
    const resetAt = new Date(oldestInWindow + config.RATE_LIMIT_WINDOW_MS);
    res.status(429).json({
      error: 'Rate limit exceeded',
      detail: `Maximum ${config.RATE_LIMIT_MAX_RUNS} runs per ${config.RATE_LIMIT_WINDOW_MS / 60000} minutes.`,
      resetAt: resetAt.toISOString(),
    });
    return;
  }

  entry.timestamps.push(now);
  store.set(userId, entry);
  next();
}
