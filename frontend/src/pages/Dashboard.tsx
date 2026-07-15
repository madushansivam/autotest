import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useRuns } from '../hooks/useRuns';
import SubmitForm from '../components/dashboard/SubmitForm';
import RunList from '../components/dashboard/RunList';
import Spinner from '../components/ui/Spinner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { runs, isLoading, mutate } = useRuns();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(url: string, label?: string) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Create application (if not exists) then trigger a run
      const app = await api.applications.create(url, label);
      const run = await api.runs.create(app.id);
      mutate(); // refresh run list
      navigate(`/runs/${run.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to start run.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // Count in-progress runs for the header indicator
  const activeRuns = (runs ?? []).filter(
    (r) => r.status === 'pending' || r.status === 'running'
  ).length;

  return (
    <div className="min-h-screen bg-surface">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-brand/5 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative border-b border-white/5 bg-surface-1/50 backdrop-blur-md sticky top-0 z-10">
        <div className="container-fluid h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-display font-bold text-white tracking-tight">AUTOTEST</span>
            {activeRuns > 0 && (
              <span className="ml-2 flex items-center gap-1 label-mono text-brand-light bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full animate-pulse-brand">
                <Spinner size="sm" />
                {activeRuns} running
              </span>
            )}
          </div>
          <button
            id="sign-out-btn"
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="relative container-fluid py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold text-white mb-2 tracking-tight">
            TEST A <span className="gradient-text">WEBSITE</span>
          </h1>
          <p className="text-slate-400 max-w-xl">
            Submit any public URL. AutoTest crawls the site, generates test cases
            using Llama-3.1-8B, and executes them with Playwright — no code required.
          </p>
        </div>

        {/* Submit form */}
        <div className="mb-12">
          <SubmitForm
            onSubmit={handleSubmit}
            loading={submitting}
            error={submitError}
          />
        </div>

        {/* Run history */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-white tracking-wide">RUN HISTORY</h2>
            {runs && runs.length > 0 && (
              <span className="label-mono">{runs.length} run{runs.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <RunList runs={runs ?? []} />
          )}
        </div>
      </main>
    </div>
  );
}