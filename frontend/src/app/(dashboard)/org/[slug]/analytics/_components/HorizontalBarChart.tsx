'use client';

interface BarChartEntry {
  label: string;
  count: number;
}

interface HorizontalBarChartProps {
  data: BarChartEntry[];
  emptyLabel: string;
}

// Single hue by design: each bar is already identified by its own label,
// so a distinct color per bar would be decorative rather than informative.
export default function HorizontalBarChart({ data, emptyLabel }: HorizontalBarChartProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="space-y-3">
      {data.map((entry) => (
        <div key={entry.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-text-secondary" title={entry.label}>
            {entry.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(entry.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-text-primary">
            {entry.count}
          </span>
        </div>
      ))}
    </div>
  );
}
