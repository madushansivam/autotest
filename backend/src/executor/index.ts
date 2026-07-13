/**
 * executor/index.ts — Playwright test script executor.
 *
 * Executes a single generated script in a fresh Playwright browser
 * context per test case. Captures:
 *  - Pass / fail / crash / skipped verdict
 *  - Failure screenshots (uploaded to Supabase Storage)
 *  - Oracle signals: HTTP status flags, console errors, screenshot diff
 *
 * Each test case gets its own browser context to ensure complete
 * isolation — state from one test cannot bleed into another.
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { chromium } from 'playwright';
import type { Page, BrowserContext } from 'playwright';
import { shouldSkipScript } from './safety-filter';
import { computeScreenshotDiff, buildOracleSignals } from './oracle';
import { supabaseAdmin } from '../lib/supabase-server';
import type { TestCase } from '../generator/types';
import type { TestResult, HttpStatusFlag } from './types';

const PAGE_LOAD_TIMEOUT = 20_000; // ms
const ACTION_TIMEOUT = 5_000;     // ms
const SCREENSHOT_BUCKET = 'screenshots';

/**
 * Uploads a screenshot to Supabase Storage and returns the public URL.
 * Uses the service-role key to bypass Storage RLS.
 */
async function uploadScreenshot(
  localPath: string,
  runId: string,
  testCaseId: string
): Promise<string | undefined> {
  try {
    const buffer = fs.readFileSync(localPath);
    const fileName = `${runId}/${testCaseId}-${Date.now()}.png`;
    const { error } = await supabaseAdmin.storage
      .from(SCREENSHOT_BUCKET)
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

    if (error) {
      console.warn('[executor] Screenshot upload failed:', error.message);
      return undefined;
    }

    const { data } = supabaseAdmin.storage
      .from(SCREENSHOT_BUCKET)
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (err) {
    console.warn('[executor] Screenshot upload error:', err);
    return undefined;
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(localPath); } catch { /* ignore */ }
  }
}

export interface ExecuteOptions {
  runId: string;
  testCaseId: string;
  targetUrl: string;
  /** URL of the previous run's screenshot for this application (for diff) */
  previousScreenshotUrl?: string | null;
}

/**
 * Executes a single generated Playwright script for the given test case.
 *
 * @param testCase — The test case (description + confidence)
 * @param script   — The generated Playwright script body
 * @param options  — Run context (IDs, target URL, previous screenshot)
 */
export async function executeTestCase(
  testCase: TestCase,
  script: string,
  options: ExecuteOptions
): Promise<TestResult> {
  const { runId, testCaseId, targetUrl, previousScreenshotUrl } = options;

  // ── Safety check: skip before touching a browser ───────────────────────
  const safetyCheck = shouldSkipScript(testCase.description, script);
  if (safetyCheck.skip) {
    return {
      result: 'skipped',
      failureCategory: `safety-filter-layer-${safetyCheck.layer}`,
      errorMessage: safetyCheck.reason,
      oracle: buildOracleSignals([], [], null, false),
      executedAt: new Date().toISOString(),
    };
  }

  if (!script || script.trim().length < 10) {
    return {
      result: 'skipped',
      failureCategory: 'no-script',
      errorMessage: 'Script generation failed or produced empty output.',
      oracle: buildOracleSignals([], [], null, false),
      executedAt: new Date().toISOString(),
    };
  }

  // ── Browser context setup ──────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  let context: BrowserContext | null = null;
  let screenshotLocalPath: string | undefined;

  try {
    context = await browser.newContext({
      userAgent: 'AutoTest-Executor/1.0',
      javaScriptEnabled: true,
    });
    context.setDefaultTimeout(ACTION_TIMEOUT);

    const page: Page = await context.newPage();

    // ── Oracle signal capture ──────────────────────────────────────────
    const httpFlags: HttpStatusFlag[] = [];
    const consoleErrors: string[] = [];

    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        httpFlags.push({ url: response.url(), status });
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`PageError: ${err.message}`);
    });

    // Navigate to target
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT,
    });

    // ── Script execution ───────────────────────────────────────────────
    // Wrap the generated script in an AsyncFunction so it can use
    // await internally while receiving `page` as a parameter.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const scriptFn = new Function(
      'page',
      `return (async (page) => { ${script} })(page);`
    );

    let verdict: { passed: boolean; error?: string };
    try {
      verdict = await Promise.race([
        scriptFn(page) as Promise<{ passed: boolean; error?: string }>,
        new Promise<{ passed: boolean; error: string }>((_, reject) =>
          setTimeout(() => reject(new Error('Script execution timed out after 15s')), 15_000)
        ),
      ]);
    } catch (err) {
      verdict = { passed: false, error: err instanceof Error ? err.message : String(err) };
    }

    // ── Screenshot on failure ──────────────────────────────────────────
    if (!verdict.passed) {
      const tmpDir = os.tmpdir();
      screenshotLocalPath = path.join(tmpDir, `autotest-${testCaseId}-${Date.now()}.png`);
      try {
        await page.screenshot({ path: screenshotLocalPath, fullPage: false });
      } catch {
        screenshotLocalPath = undefined;
      }
    }

    // ── Screenshot diff ────────────────────────────────────────────────
    // Always take a screenshot for diffing (even on pass), but only
    // if we didn't already take one for a failure.
    let diffScreenshotPath = screenshotLocalPath;
    if (!diffScreenshotPath && previousScreenshotUrl) {
      const tmpDir = os.tmpdir();
      diffScreenshotPath = path.join(tmpDir, `autotest-diff-${testCaseId}-${Date.now()}.png`);
      try {
        await page.screenshot({ path: diffScreenshotPath, fullPage: false });
      } catch {
        diffScreenshotPath = undefined;
      }
    }

    const { diffScore, diffFlagged } = await computeScreenshotDiff(
      diffScreenshotPath ?? '',
      previousScreenshotUrl ?? null
    );

    // Upload failure screenshot
    let screenshotUrl: string | undefined;
    if (screenshotLocalPath) {
      screenshotUrl = await uploadScreenshot(screenshotLocalPath, runId, testCaseId);
    }
    // Clean up diff-only screenshot (not uploaded)
    if (diffScreenshotPath && diffScreenshotPath !== screenshotLocalPath) {
      try { fs.unlinkSync(diffScreenshotPath); } catch { /* ignore */ }
    }

    const oracle = buildOracleSignals(httpFlags, consoleErrors, diffScore, diffFlagged);

    if (verdict.passed) {
      return {
        result: 'pass',
        oracle,
        screenshotUrl,
        executedAt: new Date().toISOString(),
      };
    }

    return {
      result: 'fail',
      failureCategory: 'assertion',
      errorMessage: verdict.error,
      screenshotUrl,
      oracle,
      executedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Unexpected crash (browser crash, navigation error, etc.)
    const msg = err instanceof Error ? err.message : String(err);

    // Best-effort crash screenshot
    try {
      if (context) {
        const pages = context.pages();
        if (pages.length > 0) {
          const tmpDir = os.tmpdir();
          screenshotLocalPath = path.join(tmpDir, `autotest-crash-${testCaseId}-${Date.now()}.png`);
          await pages[0].screenshot({ path: screenshotLocalPath, fullPage: false });
        }
      }
    } catch { /* ignore secondary crash */ }

    let screenshotUrl: string | undefined;
    if (screenshotLocalPath) {
      screenshotUrl = await uploadScreenshot(screenshotLocalPath, runId, testCaseId);
    }

    return {
      result: 'crash',
      failureCategory: 'browser-crash',
      errorMessage: msg,
      screenshotUrl,
      oracle: buildOracleSignals([], [], null, false),
      executedAt: new Date().toISOString(),
    };
  } finally {
    await context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
