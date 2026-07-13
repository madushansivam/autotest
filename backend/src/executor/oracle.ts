/**
 * executor/oracle.ts — Independent oracle signals for test execution.
 *
 * These signals are captured alongside the LLM's own pass/fail verdict,
 * stored separately in test_results, and displayed in the dashboard.
 * They do NOT override the LLM's verdict — they supplement it with
 * objective, deterministic observations.
 *
 * Signals:
 *   1. HTTP status capture: any 4xx/5xx responses observed during a test
 *   2. Console error capture: uncaught JS errors from the browser
 *   3. Screenshot diff: perceptual hash distance vs. previous run screenshot
 *
 * Screenshot diffing uses a difference hash (dHash) algorithm implemented
 * with the sharp image processing library. dHash is a simple, fast
 * perceptual hash that is resilient to minor layout shifts but sensitive
 * to structural visual changes.
 */

import sharp from 'sharp';
import https from 'https';
import http from 'http';
import type { OracleSignals, HttpStatusFlag } from './types';

const DIFF_THRESHOLD = 10; // Hamming distance: 0–64. >10 = flagged as changed.

// ── dHash (difference hash) implementation ─────────────────────────────────

/**
 * Computes a 64-bit difference hash of an image buffer.
 * Resizes to 9×8, converts to greyscale, then compares adjacent pixels
 * in each row. Result is a 64-character binary string.
 */
async function computeDHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const idx = row * 9 + col;
      hash += data[idx] > data[idx + 1] ? '1' : '0';
    }
  }
  return hash;
}

function hammingDistance(a: string, b: string): number {
  let dist = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

/** Downloads an image from a URL into a Buffer. */
function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Computes the perceptual hash diff score between the current screenshot
 * and the previous run's screenshot for the same application.
 *
 * @param currentScreenshotPath  Local filesystem path to the new screenshot
 * @param previousScreenshotUrl  Supabase Storage URL of the previous screenshot
 * @returns diff score (0–64) and whether it exceeds the threshold
 */
export async function computeScreenshotDiff(
  currentScreenshotPath: string,
  previousScreenshotUrl: string | null
): Promise<{ diffScore: number | null; diffFlagged: boolean }> {
  if (!previousScreenshotUrl) {
    return { diffScore: null, diffFlagged: false };
  }

  try {
    const fs = await import('fs');
    const currentBuffer = fs.readFileSync(currentScreenshotPath);
    const previousBuffer = await downloadImage(previousScreenshotUrl);

    const currentHash = await computeDHash(currentBuffer);
    const previousHash = await computeDHash(previousBuffer);

    const diffScore = hammingDistance(currentHash, previousHash);
    return { diffScore, diffFlagged: diffScore > DIFF_THRESHOLD };
  } catch (err) {
    // Diff failure is non-fatal — return null scores and log the error
    console.warn('[oracle] Screenshot diff failed:', err instanceof Error ? err.message : err);
    return { diffScore: null, diffFlagged: false };
  }
}

/**
 * Builds an OracleSignals object from raw captured data.
 * Called at the end of each test execution.
 */
export function buildOracleSignals(
  httpStatusFlags: HttpStatusFlag[],
  consoleErrors: string[],
  diffScore: number | null,
  diffFlagged: boolean
): OracleSignals {
  return {
    httpStatusFlags: httpStatusFlags.filter((f) => f.status >= 400),
    consoleErrors: consoleErrors.filter((e) => e.trim().length > 0),
    diffScore,
    diffFlagged,
  };
}
