-- ============================================================
-- AutoTest – Row-Level Security Policies
-- Migration: 20240002_rls_policies
-- All tables: users can only read/write their own data.
-- eval_ground_truth: service-role only (no user access).
-- ============================================================

-- ── applications ──────────────────────────────────────────────
alter table public.applications enable row level security;

create policy "applications: users can read own rows"
  on public.applications for select
  using (auth.uid() = user_id);

create policy "applications: users can insert own rows"
  on public.applications for insert
  with check (auth.uid() = user_id);

create policy "applications: users can update own rows"
  on public.applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "applications: users can delete own rows"
  on public.applications for delete
  using (auth.uid() = user_id);

-- ── runs ─────────────────────────────────────────────────────
alter table public.runs enable row level security;

create policy "runs: users can read own rows"
  on public.runs for select
  using (auth.uid() = user_id);

create policy "runs: users can insert own rows"
  on public.runs for insert
  with check (auth.uid() = user_id);

create policy "runs: users can update own rows"
  on public.runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "runs: users can delete own rows"
  on public.runs for delete
  using (auth.uid() = user_id);

-- ── test_cases ───────────────────────────────────────────────
-- Access controlled through parent run's user_id.
alter table public.test_cases enable row level security;

create policy "test_cases: users can read own rows"
  on public.test_cases for select
  using (
    exists (
      select 1 from public.runs
      where runs.id = test_cases.run_id
        and runs.user_id = auth.uid()
    )
  );

create policy "test_cases: users can insert into own runs"
  on public.test_cases for insert
  with check (
    exists (
      select 1 from public.runs
      where runs.id = test_cases.run_id
        and runs.user_id = auth.uid()
    )
  );

create policy "test_cases: users can update own rows"
  on public.test_cases for update
  using (
    exists (
      select 1 from public.runs
      where runs.id = test_cases.run_id
        and runs.user_id = auth.uid()
    )
  );

create policy "test_cases: users can delete own rows"
  on public.test_cases for delete
  using (
    exists (
      select 1 from public.runs
      where runs.id = test_cases.run_id
        and runs.user_id = auth.uid()
    )
  );

-- ── test_results ─────────────────────────────────────────────
-- Access controlled through grandparent run's user_id.
alter table public.test_results enable row level security;

create policy "test_results: users can read own rows"
  on public.test_results for select
  using (
    exists (
      select 1
      from public.test_cases tc
      join public.runs r on r.id = tc.run_id
      where tc.id = test_results.test_case_id
        and r.user_id = auth.uid()
    )
  );

create policy "test_results: users can insert into own test_cases"
  on public.test_results for insert
  with check (
    exists (
      select 1
      from public.test_cases tc
      join public.runs r on r.id = tc.run_id
      where tc.id = test_results.test_case_id
        and r.user_id = auth.uid()
    )
  );

create policy "test_results: users can update own rows"
  on public.test_results for update
  using (
    exists (
      select 1
      from public.test_cases tc
      join public.runs r on r.id = tc.run_id
      where tc.id = test_results.test_case_id
        and r.user_id = auth.uid()
    )
  );

create policy "test_results: users can delete own rows"
  on public.test_results for delete
  using (
    exists (
      select 1
      from public.test_cases tc
      join public.runs r on r.id = tc.run_id
      where tc.id = test_results.test_case_id
        and r.user_id = auth.uid()
    )
  );

-- ── eval_ground_truth ────────────────────────────────────────
-- No user access – service role (backend) only.
-- No RLS policies are created, so all user-role access is denied
-- by the enabled RLS with no permissive policy.
alter table public.eval_ground_truth enable row level security;

-- Service role bypasses RLS automatically in Supabase.
-- No user-facing policies = no user access to this table.

-- ── Storage: screenshots bucket ──────────────────────────────
-- Create the bucket via the dashboard or Supabase CLI:
--   supabase storage buckets create screenshots --public
-- Policy: only the owning user (identified via file path prefix
-- matching user_id) can read their own screenshots.
-- The backend uploads using the service role key, which bypasses RLS.
