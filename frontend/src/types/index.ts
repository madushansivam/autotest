// Shared frontend type definitions
// These mirror the Supabase table schemas from supabase/migrations/20240001_initial_schema.sql

export interface Application {
  id: string;
  user_id: string;
  url: string;
  label?: string;
  created_at: string;
}

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Run {
  id: string;
  application_id: string;
  user_id: string;
  started_at: string;
  finished_at?: string;
  status: RunStatus;
  pages_crawled: number;
  llm_calls_used: number;
  error_message?: string;
  // Joined from applications (API may include this)
  application?: Application;
}

export type ConfidenceTag = 'structural' | 'behavioral' | 'unvalidated';

export interface TestCase {
  id: string;
  run_id: string;
  description: string;
  confidence: ConfidenceTag;
  generated_script?: string;
  created_at: string;
  // Joined from test_results
  result?: TestResult;
}

export type TestResultStatus = 'pass' | 'fail' | 'crash' | 'skipped';

export interface HttpStatusFlag {
  url: string;
  status: number;
}

export interface TestResult {
  id: string;
  test_case_id: string;
  result: TestResultStatus;
  failure_category?: string;
  error_message?: string;
  screenshot_url?: string;
  executed_at: string;
  // Oracle signals
  http_status_flags?: HttpStatusFlag[];
  console_errors?: string[];
  diff_score?: number;
  diff_flagged?: boolean;
}

// Detail view: run + test cases + results
export interface RunDetail extends Run {
  test_cases: TestCase[];
  // Aggregated stats (computed by API)
  stats: {
    total: number;
    passed: number;
    failed: number;
    crashed: number;
    skipped: number;
  };
}
