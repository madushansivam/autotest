/**
 * api/routes/runs.ts — Run CRUD routes.
 *
 * POST   /api/runs          — Start a new pipeline run (async)
 * GET    /api/runs          — List all runs for the current user
 * GET    /api/runs/:id      — Get run detail (test cases + results)
 * DELETE /api/runs/:id      — Delete a run
 *
 * The pipeline is triggered asynchronously so the POST returns
 * immediately with the run record (status: 'pending'). The client
 * polls GET /api/runs/:id until status is 'completed' or 'failed'.
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../lib/supabase-server';
import { authMiddleware } from '../middleware/auth';
import { validateBody, createRunSchema } from '../middleware/validate';
import { runRateLimiter } from '../../lib/rate-limiter';
import { runPipeline } from '../../pipeline/index';
import type { z } from 'zod';

const router = Router();

router.use(authMiddleware);

// POST /api/runs — trigger a pipeline run
router.post(
  '/',
  runRateLimiter,
  validateBody(createRunSchema),
  async (
    req: Request & { userId?: string; validatedBody?: z.infer<typeof createRunSchema> },
    res: Response
  ): Promise<void> => {
    const { applicationId } = req.validatedBody!;
    const userId = req.userId!;

    // Verify application ownership and get the URL
    const { data: app, error: appError } = await supabaseAdmin
      .from('applications')
      .select('id, url')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .single();

    if (appError || !app) {
      res.status(404).json({ error: 'Application not found or access denied.' });
      return;
    }

    const { url } = app as { id: string; url: string };

    // Create the run record immediately so the client has an ID to poll
    const { data: run, error: runError } = await supabaseAdmin
      .from('runs')
      .insert({
        application_id: applicationId,
        user_id: userId,
        status: 'pending',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError || !run) {
      res.status(500).json({ error: 'Failed to create run record.' });
      return;
    }

    const runId = (run as { id: string }).id;

    // Respond immediately — pipeline runs in the background
    res.status(201).json(run);

    // Fire-and-forget: update to 'running' then execute pipeline
    setImmediate(async () => {
      await supabaseAdmin
        .from('runs')
        .update({ status: 'running' })
        .eq('id', runId);

      await runPipeline({
        url,
        userId,
        applicationId,
        runId,
        persistToDb: true,
      }).catch((err) => {
        console.error(`[runs] Pipeline error for run ${runId}:`, err);
      });
    });
  }
);

// GET /api/runs — list runs for the current user
router.get('/', async (req: Request & { userId?: string }, res: Response): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('runs')
    .select(`
      *,
      applications (id, url, label)
    `)
    .eq('user_id', req.userId!)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

// GET /api/runs/:id — run detail with test cases and results
router.get('/:id', async (req: Request & { userId?: string }, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data: run, error: runError } = await supabaseAdmin
    .from('runs')
    .select(`
      *,
      applications (id, url, label),
      test_cases (
        *,
        test_results (*)
      )
    `)
    .eq('id', id)
    .eq('user_id', req.userId!)
    .single();

  if (runError || !run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }

  // Compute aggregate stats
  const testCases = (run as { test_cases?: Array<{ test_results?: Array<{ result: string }> }> }).test_cases ?? [];
  const allResults = testCases.flatMap((tc) => tc.test_results ?? []);

  const stats = {
    total: allResults.length,
    passed: allResults.filter((r) => r.result === 'pass').length,
    failed: allResults.filter((r) => r.result === 'fail').length,
    crashed: allResults.filter((r) => r.result === 'crash').length,
    skipped: allResults.filter((r) => r.result === 'skipped').length,
  };

  res.json({ ...run, stats });
});

// DELETE /api/runs/:id
router.delete('/:id', async (req: Request & { userId?: string }, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data: existing } = await supabaseAdmin
    .from('runs')
    .select('id')
    .eq('id', id)
    .eq('user_id', req.userId!)
    .single();

  if (!existing) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }

  const { error } = await supabaseAdmin.from('runs').delete().eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true, deletedId: id });
});

export default router;
