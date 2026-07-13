import type { Run } from '../../types';
import RunCard from './RunCard';

interface RunListProps {
  runs: Run[];
}

export default function RunList({ runs }: RunListProps) {
  if (runs.length === 0) {
    return (
      <div className="glass p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-400 font-medium">No runs yet</p>
        <p className="text-slate-500 text-sm mt-1">Submit a URL above to start your first test run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <div key={run.id} className="animate-slide-up">
          <RunCard run={run as Parameters<typeof RunCard>[0]['run']} />
        </div>
      ))}
    </div>
  );
}
