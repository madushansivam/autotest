/**
 * api/routes/applications.ts — Application CRUD routes.
 *
 * POST   /api/applications  — Create a new application record
 * GET    /api/applications  — List all applications for the current user
 * DELETE /api/applications/:id — Delete an application and all its runs
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../lib/supabase-server';
import { authMiddleware } from '../middleware/auth';
import { validateBody, createApplicationSchema } from '../middleware/validate';
import { validateTargetUrl, SsrfBlockedError } from '../../lib/ssrf-guard';
import type { z } from 'zod';

const router = Router();

router.use(authMiddleware);

// POST /api/applications
router.post(
  '/',
  validateBody(createApplicationSchema),
  async (req: Request & { userId?: string; validatedBody?: z.infer<typeof createApplicationSchema> }, res: Response): Promise<void> => {
    const { url, label } = req.validatedBody!;
    const userId = req.userId!;

    // SSRF guard: validate the URL before storing it
    try {
      await validateTargetUrl(url);
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from('applications')
      .insert({ user_id: userId, url, label })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  }
);

// GET /api/applications
router.get('/', async (req: Request & { userId?: string }, res: Response): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('*')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

// DELETE /api/applications/:id
router.delete('/:id', async (req: Request & { userId?: string }, res: Response): Promise<void> => {
  const { id } = req.params;

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from('applications')
    .select('id')
    .eq('id', id)
    .eq('user_id', req.userId!)
    .single();

  if (!existing) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('applications')
    .delete()
    .eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true, deletedId: id });
});

export default router;
