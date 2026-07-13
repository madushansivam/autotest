/**
 * retry.ts — Shared LLM output retry helper.
 *
 * Consolidates the three copy-pasted retry loops from the prototype
 * (generate-tests.js, generate-playwright-scripts.js, run-pipeline.js)
 * into a single reusable utility.
 *
 * Usage:
 *   const result = await retryUntilValidJson(
 *     () => callLlm(prompt),
 *     (parsed): parsed is MyType => Array.isArray(parsed),
 *     3
 *   );
 */

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

/**
 * Strips markdown code fences from LLM output.
 * Llama-3.1-8B frequently wraps JSON in ```json ... ``` blocks
 * despite being instructed not to.
 */
export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json|javascript|js|typescript|ts)?\s*\n?/m, '')
    .replace(/```\s*$/m, '')
    .trim();
}

/**
 * Attempts to call `callFn` up to `maxAttempts` times, parsing the
 * result as JSON and validating it with `validator` on each attempt.
 *
 * Throws if all attempts fail, with a detailed error message listing
 * each failure reason for debugging.
 */
export async function retryUntilValidJson<T>(
  callFn: (attempt: number) => Promise<string>,
  validator: (parsed: unknown) => parsed is T,
  maxAttempts = 3
): Promise<RetryResult<T>> {
  const failures: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let raw = '';
    try {
      raw = await callFn(attempt);
      const cleaned = stripCodeFences(raw);
      const parsed = JSON.parse(cleaned) as unknown;

      if (validator(parsed)) {
        return { value: parsed, attempts: attempt };
      }

      failures.push(`Attempt ${attempt}: JSON valid but failed type validator`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`Attempt ${attempt}: ${msg} (raw length: ${raw.length})`);
    }
  }

  throw new Error(
    `LLM output failed validation after ${maxAttempts} attempts:\n` +
    failures.join('\n')
  );
}

/**
 * Simpler variant for plain text output (e.g. script generation)
 * where the validity check is not JSON parsing but a custom predicate.
 */
export async function retryUntilValid<T>(
  callFn: (attempt: number) => Promise<T>,
  validator: (result: T) => boolean,
  maxAttempts = 3
): Promise<RetryResult<T>> {
  const failures: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await callFn(attempt);
      if (validator(result)) {
        return { value: result, attempts: attempt };
      }
      failures.push(`Attempt ${attempt}: validator returned false`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`Attempt ${attempt}: ${msg}`);
    }
  }

  throw new Error(
    `All ${maxAttempts} attempts failed:\n` + failures.join('\n')
  );
}
