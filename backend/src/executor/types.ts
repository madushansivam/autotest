/**
 * executor/types.ts — Type definitions for test execution.
 */

export type ExecutionResult = 'pass' | 'fail' | 'crash' | 'skipped';

export interface HttpStatusFlag {
  url: string;
  status: number;
}

/** Independent oracle signals captured during test execution */
export interface OracleSignals {
  /** Any HTTP 4xx/5xx responses observed during the test run */
  httpStatusFlags: HttpStatusFlag[];
  /** Uncaught JavaScript errors from the browser console */
  consoleErrors: string[];
  /**
   * Perceptual hash Hamming distance vs the previous run's screenshot
   * for the same application (0 = identical, 64 = completely different).
   * null if no previous screenshot exists.
   */
  diffScore: number | null;
  /** true if diffScore exceeds the configured threshold */
  diffFlagged: boolean;
}

export interface TestResult {
  result: ExecutionResult;
  failureCategory?: string;
  errorMessage?: string;
  screenshotUrl?: string;
  /** Path to the screenshot on disk before upload */
  screenshotLocalPath?: string;
  oracle: OracleSignals;
  executedAt: string;
}
