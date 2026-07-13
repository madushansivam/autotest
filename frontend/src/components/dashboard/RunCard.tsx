import { Link } from 'react-router-dom';
import type { Run } from '../../types';
import Badge from '../ui/Badge';
import StatBar from '../ui/StatBar';

interface RunCardProps {
  run: Run & {
    application?: { url: string; label?: string };
    stats?: { total: number; passed: number; failed: number; crashed: number; skipped: number };
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RunCard({ run }: RunCardProps) {
  const app = run.application;
  const stats = run.stats;
  const isLive = run.status === 'pending' || run.status === 'running';

  return (
    <Link
      to={`/runs/${run.id}`}
      className="block glass hover:bg-surface-1 hover:border-white/10 hover:-translate-y-0.5 transition-all duration-200 p-5 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-white truncate">
              {app?.label ?? app?.url ?? 'Unknown site'}
            </p>
            <Badge variant={run.status} />
          </div>
          {app?.label && (
            <p className="text-xs text-slate-500 truncate mb-2">{app.url}</p>
          )}

          {/* Stats bar */}
          {stats && stats.total > 0 && (
            <div className="mt-2">
              <StatBar
                passed={stats.passed}
                failed={stats.failed}
                crashed={stats.crashed}
                skipped={stats.skipped}
                total={stats.total}
              />
              <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
                <span>{stats.total} tests</span>
                {stats.passed > 0 && <span className="text-pass">{stats.passed}✓</span>}
                {stats.failed > 0 && <span className="text-fail">{stats.failed}✗</span>}
                {stats.crashed > 0 && <span className="text-crash">{stats.crashed}💥</span>}
              </div>
            </div>
          )}

          {isLive && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-brand-light">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-light animate-pulse" />
              Running…
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-slate-500">{timeAgo(run.started_at)}</span>
          <span className="text-xs text-slate-600">{run.pages_crawled} pg</span>
        </div>
      </div>
    </Link>
  );
}
