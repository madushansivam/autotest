interface StatBarProps {
  passed: number;
  failed: number;
  crashed: number;
  skipped: number;
  total: number;
}

export default function StatBar({ passed, failed, crashed, skipped, total }: StatBarProps) {
  if (total === 0) {
    return <div className="h-2 rounded-full bg-surface-3 overflow-hidden" />;
  }

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="h-2 rounded-full bg-surface-3 overflow-hidden flex">
      {passed > 0 && (
        <div
          className="h-full bg-pass transition-all duration-500"
          style={{ width: pct(passed) }}
          title={`${passed} passed`}
        />
      )}
      {failed > 0 && (
        <div
          className="h-full bg-fail transition-all duration-500"
          style={{ width: pct(failed) }}
          title={`${failed} failed`}
        />
      )}
      {crashed > 0 && (
        <div
          className="h-full bg-crash transition-all duration-500"
          style={{ width: pct(crashed) }}
          title={`${crashed} crashed`}
        />
      )}
      {skipped > 0 && (
        <div
          className="h-full bg-skip/60 transition-all duration-500"
          style={{ width: pct(skipped) }}
          title={`${skipped} skipped`}
        />
      )}
    </div>
  );
}
