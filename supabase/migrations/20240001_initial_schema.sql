-- ============================================================
-- AutoTest – Initial Schema
-- Migration: 20240001_initial_schema
-- ============================================================
-- Enable the pgcrypto extension for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- applications
-- One row per target site a user wants to test.
-- user_id references Supabase Auth; no separate users table needed.
-- ------------------------------------------------------------
create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  url         text not null,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists applications_user_id_idx on public.applications(user_id);

-- ------------------------------------------------------------
-- runs
-- One row per execution of the full crawl→generate→execute pipeline.
-- ------------------------------------------------------------
create table if not exists public.runs (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'pending'
                  check (status in ('pending', 'running', 'completed', 'failed')),
  pages_crawled   int not null default 0,
  llm_calls_used  int not null default 0,
  error_message   text  -- populated if status = 'failed'
);

create index if not exists runs_application_id_idx on public.runs(application_id);
create index if not exists runs_user_id_idx on public.runs(user_id);
create index if not exists runs_status_idx on public.runs(status);

-- ------------------------------------------------------------
-- test_cases
-- One row per LLM-generated test-case description + script.
-- IMPORTANT: LLM-generated tests without a ground-truth oracle
-- can only reliably detect structural breakage and crashes.
-- Behavioral tests tagged here assert specific outcomes, but
-- without a real oracle those assertions are LLM-judged, not
-- objectively verified. This is a known, accepted limitation.
-- ------------------------------------------------------------
create table if not exists public.test_cases (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references public.runs(id) on delete cascade,
  description      text not null,
  confidence       text not null default 'unvalidated'
                   check (confidence in ('structural', 'behavioral', 'unvalidated')),
  generated_script text,
  created_at       timestamptz not null default now()
);

create index if not exists test_cases_run_id_idx on public.test_cases(run_id);

-- ------------------------------------------------------------
-- test_results
-- One row per execution of a test_case.
-- Also stores independent oracle signals (HTTP errors, console
-- errors, screenshot diff) alongside the LLM verdict – these
-- are stored separately, not used to override the LLM result.
-- ------------------------------------------------------------
create table if not exists public.test_results (
  id                uuid primary key default gen_random_uuid(),
  test_case_id      uuid not null references public.test_cases(id) on delete cascade,
  result            text not null
                    check (result in ('pass', 'fail', 'crash', 'skipped')),
  failure_category  text,
  error_message     text,
  screenshot_url    text,  -- Supabase Storage public URL
  executed_at       timestamptz not null default now(),
  -- Oracle signals (Section 8) – independent of LLM verdict
  http_status_flags jsonb,   -- array of {url, status} for any 4xx/5xx observed
  console_errors    jsonb,   -- array of uncaught JS error strings
  diff_score        float,   -- perceptual hash Hamming distance vs previous run (0-64)
  diff_flagged      boolean  -- true if diff_score exceeds configured threshold
);

create index if not exists test_results_test_case_id_idx on public.test_results(test_case_id);

-- ------------------------------------------------------------
-- eval_ground_truth
-- Human-authored reference test cases used ONLY by the
-- evaluation harness (eval/run-eval.ts). Not shown in the
-- product UI. Service-role writes only.
-- ------------------------------------------------------------
create table if not exists public.eval_ground_truth (
  id               uuid primary key default gen_random_uuid(),
  application_url  text not null,
  description      text not null,
  expected_outcome text,
  authored_by      text not null,
  created_at       timestamptz not null default now()
);

create index if not exists eval_ground_truth_url_idx on public.eval_ground_truth(application_url);
