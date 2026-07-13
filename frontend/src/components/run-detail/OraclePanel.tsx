import { clsx } from 'clsx';
import type { TestResult } from '../../types';

interface OraclePanelProps {
  result: TestResult;
  className?: string;
}

export default function OraclePanel({ result, className }: OraclePanelProps) {
  const { http_status_flags, console_errors, diff_score, diff_flagged } = result;

  const hasHttpErrors = http_status_flags && http_status_flags.length > 0;
  const hasConsoleErrors = console_errors && console_errors.length > 0;
  const hasDiff = diff_score !== null && diff_score !== undefined;

  // If no oracle signals, show nothing
  if (!hasHttpErrors && !hasConsoleErrors && !hasDiff) return null;

  return (
    <div className={clsx('px-4 py-3 bg-surface-1/50 border border-white/5 rounded-xl text-xs space-y-2', className)}>
      <p className="font-semibold text-slate-400 uppercase tracking-widest text-[10px]">
        Oracle Signals
      </p>

      {/* HTTP errors */}
      {hasHttpErrors && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-crash">⚠</span>
          <div>
            <span className="text-crash font-medium">HTTP errors: </span>
            <span className="text-slate-400">
              {http_status_flags!.map((f) => `${f.status} (${new URL(f.url).pathname})`).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Console errors */}
      {hasConsoleErrors && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-fail">⚠</span>
          <div>
            <span className="text-fail font-medium">Console errors ({console_errors!.length}): </span>
            <span className="text-slate-400 font-mono">{console_errors![0].slice(0, 100)}</span>
            {console_errors!.length > 1 && (
              <span className="text-slate-500"> +{console_errors!.length - 1} more</span>
            )}
          </div>
        </div>
      )}

      {/* Screenshot diff */}
      {hasDiff && (
        <div className="flex items-center gap-2">
          <span className={diff_flagged ? 'text-crash' : 'text-pass'}>
            {diff_flagged ? '⚠' : '✓'}
          </span>
          <span>
            <span className={`font-medium ${diff_flagged ? 'text-crash' : 'text-slate-400'}`}>
              Visual diff:
            </span>{' '}
            <span className="text-slate-400">
              Hamming distance {diff_score}/64 {diff_flagged ? '(flagged as changed)' : '(no significant change)'}
            </span>
          </span>
        </div>
      )}

      <p className="text-slate-600 text-[10px] pt-1">
        Oracle signals are independent of the AI verdict and stored separately.
      </p>
    </div>
  );
}
