import { useState } from 'react';
import type { TestCase } from '../../types';
import Badge from '../ui/Badge';
import ScreenshotModal from './ScreenshotModal';

interface TestCaseCardProps {
  testCase: TestCase;
}

export default function TestCaseCard({ testCase: tc }: TestCaseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);

  const result = tc.result;
  const hasFailureDetails = result && (result.error_message || result.screenshot_url);

  return (
    <>
      <div className="glass overflow-hidden">
        {/* Header row */}
        <button
          className="w-full text-left p-5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {/* Result icon */}
          <div className="mt-0.5 shrink-0">
            {result ? (
              <span className="text-lg">
                {{ pass: '✅', fail: '❌', crash: '💥', skipped: '⏭' }[result.result] ?? '⏳'}
              </span>
            ) : (
              <span className="text-lg">⏳</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white leading-snug">{tc.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant={tc.confidence} />
              {result && <Badge variant={result.result} />}
              {result?.failure_category && (
                <span className="text-xs text-slate-500">{result.failure_category}</span>
              )}
            </div>
          </div>

          {/* Expand chevron */}
          <svg
            className={`w-4 h-4 text-slate-500 shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expanded body */}
        {expanded && (
          <div className="border-t border-white/5 p-5 space-y-4 animate-fade-in">
            {/* Failure details */}
            {hasFailureDetails && (
              <div className="space-y-3">
                {result?.error_message && (
                  <div className="p-3 bg-fail/10 border border-fail/20 rounded-lg">
                    <p className="text-xs font-semibold text-fail mb-1">Error</p>
                    <p className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all">
                      {result.error_message}
                    </p>
                  </div>
                )}
                {result?.screenshot_url && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2">Failure screenshot</p>
                    <button
                      onClick={() => setScreenshotOpen(true)}
                      className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-white/20 transition-all"
                    >
                      <img
                        src={result.screenshot_url}
                        alt="Failure screenshot"
                        className="w-full max-h-32 object-cover object-top group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <span className="text-white text-xs font-semibold">View full</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Generated script */}
            {tc.generated_script && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">Generated Playwright script</p>
                <pre className="bg-surface-2 border border-white/5 rounded-lg p-3 text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {tc.generated_script}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {result?.screenshot_url && (
        <ScreenshotModal
          url={result.screenshot_url}
          open={screenshotOpen}
          onClose={() => setScreenshotOpen(false)}
        />
      )}
    </>
  );
}
