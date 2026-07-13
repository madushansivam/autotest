import { clsx } from 'clsx';
import type { TestResultStatus, ConfidenceTag } from '../../types';

type BadgeVariant = TestResultStatus | ConfidenceTag | 'pending' | 'running' | 'completed' | 'failed';

const variantStyles: Record<BadgeVariant, string> = {
  // Test result
  pass: 'bg-pass/15 text-pass border-pass/30',
  fail: 'bg-fail/15 text-fail border-fail/30',
  crash: 'bg-crash/15 text-crash border-crash/30',
  skipped: 'bg-skip/15 text-skip border-skip/30',
  // Confidence
  structural: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  behavioral: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  unvalidated: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  // Run status
  pending: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  running: 'bg-brand/15 text-brand-light border-brand/30 animate-pulse-brand',
  completed: 'bg-pass/15 text-pass border-pass/30',
  failed: 'bg-fail/15 text-fail border-fail/30',
};

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

export default function Badge({ variant, label, className }: BadgeProps) {
  const text = label ?? variant.charAt(0).toUpperCase() + variant.slice(1);
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border tracking-wide',
        variantStyles[variant],
        className
      )}
    >
      {text}
    </span>
  );
}
