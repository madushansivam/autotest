/**
 * pipeline/index.ts — THE single canonical AutoTest pipeline.
 *
 * This is the only place where crawl → generate → execute is orchestrated.
 * Both the Express API route (api/routes/runs.ts) and the CLI (cli.ts)
 * call runPipeline(). There is no duplicate implementation.
 *
 * Flow:
 *   1. Validate URL (SSRF guard)
 *   2. Crawl: Playwright BFS → InterfaceMap
 *   3. Generate: Llama-3.1-8B → test-case descriptions
 *   4. Generate: Llama-3.1-8B → Playwright scripts (per test case)
 *   5. Execute: each script in its own browser context
 *   6. Persist: write run + test_cases + test_results to Supabase
 *
 * Budget enforcement:
 *   - Pages crawled: config.MAX_PAGES_PER_RUN (passed to crawl())
 *   - LLM calls: config.MAX_LLM_CALLS_PER_RUN (enforced in step 3+4)
 */

import { validateTargetUrl } from '../lib/ssrf-guard';
import { supabaseAdmin } from '../lib/supabase-server';
import { crawl } from '../crawler/index';
import { generateTestCases, generateScript } from '../generator/index';
import { executeTestCase } from '../executor/index';
import { config } from '../config';
import type { InterfaceMap } from '../crawler/types';
import type { TestCase } from '../generator/types';
import type { TestResult } from '../executor/types';

export interface PipelineInput {
  url: string;
  userId: string;
  applicationId?: string;
  runId?: string;
  /** If false, results are returned but not written to Supabase (for eval harness) */
  persistToDb?: boolean;
}

export interface PipelineTestResult {
  testCase: TestCase;
  script: string;
  result: TestResult['result'];
  errorMessage?: string;
  screenshotUrl?: string;
  oracle: TestResult['oracle'];
}

export interface PipelineResult {
  runId: string | null;
  url: string;
  interfaceMap: InterfaceMap;
  testResults: PipelineTestResult[];
  llmCallsUsed: number;
  status: 'completed' | 'failed';
  error?: string;
}

/** Fetches the most recent screenshot URL for an application (for diff) */
async function getPreviousScreenshotUrl(
  applicationId: string | undefined
): Promise<string | null> {
  if (!applicationId) return null;
  try {
    const { data } = await supabaseAdmin
      .from('test_results')
      .select('screenshot_url, test_cases!inner(run_id, runs!inner(application_id))')
      .eq('test_cases.runs.application_id', applicationId)
      .not('screenshot_url', 'is', null)
      .order('executed_at', { ascending: false })
      .limit(1)
      .single();

    return (data as { screenshot_url?: string } | null)?.screenshot_url ?? null;
  } catch {
    return null;
  }
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { url, userId, applicationId, persistToDb = true } = input;
  let runId = input.runId ?? null;
  let llmCallsUsed = 0;

  // ── 1. SSRF guard (first check; crawler re-checks before each navigation) ──
  try {
    await validateTargetUrl(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (runId && persistToDb) {
      await supabaseAdmin
        .from('runs')
        .update({ status: 'failed', finished_at: new Date().toISOString(), error_message: msg })
        .eq('id', runId);
    }
    return {
      runId,
      url,
      interfaceMap: { baseUrl: url, pages: [], crawledAt: new Date().toISOString(), totalElements: 0 },
      testResults: [],
      llmCallsUsed: 0,
      status: 'failed',
      error: msg,
    };
  }

  // ── 2. Create run record ──────────────────────────────────────────────────
  if (persistToDb && !runId) {
    const { data: run, error } = await supabaseAdmin
      .from('runs')
      .insert({
        application_id: applicationId,
        user_id: userId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !run) {
      throw new Error(`Failed to create run record: ${error?.message}`);
    }
    runId = (run as { id: string }).id;
  }

  const updateRun = async (patch: Record<string, unknown>) => {
    if (!persistToDb || !runId) return;
    await supabaseAdmin.from('runs').update(patch).eq('id', runId);
  };

  try {
    // ── 3. Crawl ────────────────────────────────────────────────────────────
    console.log(`[pipeline] Crawling ${url}...`);
    const interfaceMap = await crawl(url, { budget: config.MAX_PAGES_PER_RUN });
    await updateRun({ pages_crawled: interfaceMap.pages.length });
    console.log(`[pipeline] Crawled ${interfaceMap.pages.length} pages, ${interfaceMap.totalElements} elements`);

    // ── 4. Generate test-case descriptions ──────────────────────────────────
    const remainingLlmBudget = () => config.MAX_LLM_CALLS_PER_RUN - llmCallsUsed;

    if (remainingLlmBudget() <= 0 || interfaceMap.pages.length === 0) {
      await updateRun({ status: 'completed', finished_at: new Date().toISOString(), llm_calls_used: llmCallsUsed });
      return { runId, url, interfaceMap, testResults: [], llmCallsUsed, status: 'completed' };
    }

    console.log('[pipeline] Generating test cases...');
    const { testCases, llmCallsUsed: genCalls } = await generateTestCases(interfaceMap);
    llmCallsUsed += genCalls;
    await updateRun({ llm_calls_used: llmCallsUsed });
    console.log(`[pipeline] Generated ${testCases.length} test cases (${llmCallsUsed} LLM calls)`);

    // ── 5. Persist test cases ────────────────────────────────────────────────
    const testCaseIds: string[] = [];
    if (persistToDb && runId) {
      for (const tc of testCases) {
        const { data } = await supabaseAdmin
          .from('test_cases')
          .insert({ run_id: runId, description: tc.description, confidence: tc.confidence })
          .select()
          .single();
        testCaseIds.push((data as { id: string } | null)?.id ?? '');
      }
    }

    // ── 6. Generate scripts + execute ────────────────────────────────────────
    const previousScreenshot = await getPreviousScreenshotUrl(applicationId);
    const pipelineResults: PipelineTestResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const tcId = testCaseIds[i] ?? `ephemeral-${i}`;

      if (remainingLlmBudget() <= 0) {
        console.warn(`[pipeline] LLM budget exhausted (${config.MAX_LLM_CALLS_PER_RUN} calls). Skipping remaining test cases.`);
        break;
      }

      // Generate script
      const { script, generationFailed, llmCallsUsed: scriptCalls } = await generateScript(tc, interfaceMap);
      llmCallsUsed += scriptCalls;
      await updateRun({ llm_calls_used: llmCallsUsed });

      // Persist generated script to test_cases record
      if (persistToDb && tcId && !tcId.startsWith('ephemeral')) {
        await supabaseAdmin
          .from('test_cases')
          .update({ generated_script: script })
          .eq('id', tcId);
      }

      // Execute
      const execResult = await executeTestCase(tc, script, {
        runId: runId ?? 'ephemeral',
        testCaseId: tcId,
        targetUrl: url,
        previousScreenshotUrl: previousScreenshot,
      });

      // Persist result
      if (persistToDb && tcId && !tcId.startsWith('ephemeral')) {
        await supabaseAdmin.from('test_results').insert({
          test_case_id: tcId,
          result: execResult.result,
          failure_category: execResult.failureCategory,
          error_message: execResult.errorMessage,
          screenshot_url: execResult.screenshotUrl,
          executed_at: execResult.executedAt,
          http_status_flags: execResult.oracle.httpStatusFlags,
          console_errors: execResult.oracle.consoleErrors,
          diff_score: execResult.oracle.diffScore,
          diff_flagged: execResult.oracle.diffFlagged,
        });
      }

      pipelineResults.push({
        testCase: tc,
        script: generationFailed ? '' : script,
        result: execResult.result,
        errorMessage: execResult.errorMessage,
        screenshotUrl: execResult.screenshotUrl,
        oracle: execResult.oracle,
      });

      console.log(`[pipeline] [${i + 1}/${testCases.length}] ${tc.description.slice(0, 60)} → ${execResult.result}`);
    }

    // ── 7. Finalise run ──────────────────────────────────────────────────────
    await updateRun({
      status: 'completed',
      finished_at: new Date().toISOString(),
      llm_calls_used: llmCallsUsed,
    });

    return { runId, url, interfaceMap, testResults: pipelineResults, llmCallsUsed, status: 'completed' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pipeline] Pipeline failed:', msg);
    await updateRun({ status: 'failed', finished_at: new Date().toISOString(), error_message: msg });
    return {
      runId,
      url,
      interfaceMap: { baseUrl: url, pages: [], crawledAt: new Date().toISOString(), totalElements: 0 },
      testResults: [],
      llmCallsUsed,
      status: 'failed',
      error: msg,
    };
  }
}
