import { useParams, Link } from 'react-router-dom';
import { useRunDetail } from '../hooks/useRunDetail';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import StatBar from '../components/ui/StatBar';
import TestCaseCard from '../components/run-detail/TestCaseCard';
import OraclePanel from '../components/run-detail/OraclePanel';

function formatDuration(startedAt: string, finishedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const { run, isLoading, error } = useRunDetail(runId!);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-fail text-lg font-semibold">Failed to load run</p>
          <p className="text-slate-400 mt-2">{error ?? 'Run not found'}</p>
          <Link to="/" className="mt-4 inline-block text-brand-light hover:underline text-sm">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isLive = run.status === 'pending' || run.status === 'running';
  const app = run.application;

  return (
    <div className="min-h-screen bg-surface">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-brand/5 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative border-b border-white/5 bg-surface-1/50 backdrop-blur-md sticky top-0 z-10">
        <div className="container-fluid h-14 flex items-center gap-3">
          <Link
            to="/"
            className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-sm text-slate-300 truncate max-w-xs">{app?.url ?? run.id}</span>
          <Badge variant={run.status} className="ml-auto" />
        </div>
      </nav>

      <main className="relative container-fluid py-8 animate-fade-in">
        {/* Run header */}
        <div className="glass p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-white truncate tracking-tight">
                {(app?.label ?? app?.url ?? '').toUpperCase()}
              </h1>
              {app?.label && <p className="text-sm text-slate-400 truncate mt-0.5">{app.url}</p>}
              <div className="flex flex-wrap gap-4 mt-3 label-mono">
                <span>DURATION: {formatDuration(run.started_at, run.finished_at)}</span>
                <span>PAGES: {run.pages_crawled}</span>
                <span>LLM CALLS: {run.llm_calls_used}</span>
              </div>
            </div>

            {isLive && (
              <div className="flex items-center gap-2 text-brand-light text-sm shrink-0">
                <Spinner size="sm" />
                Running…
              </div>
            )}
          </div>

          {/* Stats bar */}
          {run.stats && run.stats.total > 0 && (
            <div className="mt-5">
              <div className="flex justify-between label-mono mb-2">
                <span>{run.stats.total} TESTS</span>
                <span className="text-pass">{Math.round((run.stats.passed / run.stats.total) * 100)}% PASS</span>
              </div>
              <StatBar
                passed={run.stats.passed}
                failed={run.stats.failed}
                crashed={run.stats.crashed}
                skipped={run.stats.skipped}
                total={run.stats.total}
              />
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                {run.stats.passed > 0 && <span className="text-pass">{run.stats.passed} passed</span>}
                {run.stats.failed > 0 && <span className="text-fail">{run.stats.failed} failed</span>}
                {run.stats.crashed > 0 && <span className="text-crash">{run.stats.crashed} crashed</span>}
                {run.stats.skipped > 0 && <span className="text-skip">{run.stats.skipped} skipped</span>}
              </div>
            </div>
          )}

          {run.error_message && (
            <div className="mt-4 p-3 bg-fail/10 border border-fail/20 rounded-xl text-sm text-fail">
              {run.error_message}
            </div>
          )}
        </div>

        {/* Limitation notice */}
        <div className="mb-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-xs text-yellow-400/80">
          <strong>Note:</strong> AI-generated tests can reliably detect structural breakage and crashes.
          Behavioral tests assert visible outcomes but cannot verify business-logic correctness without a ground-truth oracle.
        </div>

        {/* Test cases */}
        {isLive && (!run.test_cases || run.test_cases.length === 0) ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Spinner size="lg" />
            <p className="text-slate-400">Pipeline running — crawling and generating tests…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(run.test_cases ?? []).map((tc) => (
              <div key={tc.id} className="animate-slide-up">
                <TestCaseCard testCase={tc} />
                {tc.result && (
                  <OraclePanel result={tc.result} className="mt-1 ml-4" />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}