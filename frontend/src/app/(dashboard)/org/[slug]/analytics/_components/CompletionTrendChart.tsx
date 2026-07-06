'use client';

import type { TrendPoint } from '@/types/analytics.types';

interface CompletionTrendChartProps {
  created: TrendPoint[];
  completed: TrendPoint[];
}

const WIDTH = 640;
const HEIGHT = 200;
const PADDING_LEFT = 24;
const PADDING_RIGHT = 40;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 16;

function buildPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

// Same validated color pair and minimal-hover approach as the super admin
// panel's GrowthChart (northpeak/brand pass the dataviz palette validator) —
// kept as a separate component since this lives in an unrelated route tree.
export default function CompletionTrendChart({ created, completed }: CompletionTrendChartProps) {
  const maxCount = Math.max(1, ...created.map((p) => p.count), ...completed.map((p) => p.count));
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = created.length > 1 ? plotWidth / (created.length - 1) : 0;

  const toPoints = (series: TrendPoint[]) =>
    series.map((p, i) => ({
      x: PADDING_LEFT + i * stepX,
      y: PADDING_TOP + plotHeight - (p.count / maxCount) * plotHeight,
      count: p.count,
      date: p.date,
    }));

  const createdPoints = toPoints(created);
  const completedPoints = toPoints(completed);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => PADDING_TOP + plotHeight * t);
  const lastCreated = createdPoints[createdPoints.length - 1];
  const lastCompleted = completedPoints[completedPoints.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Tasks created vs completed per day"
      >
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={PADDING_LEFT}
            x2={WIDTH - PADDING_RIGHT}
            y1={y}
            y2={y}
            stroke="var(--color-border-subtle)"
            strokeWidth={1}
          />
        ))}

        <path
          d={buildPath(createdPoints)}
          fill="none"
          stroke="var(--color-workspace-northpeak)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={buildPath(completedPoints)}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {createdPoints.map((p, i) => (
          <circle key={`c-${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-workspace-northpeak)" stroke="var(--color-surface)" strokeWidth={2}>
            <title>{`${p.date}: ${p.count} created`}</title>
          </circle>
        ))}
        {completedPoints.map((p, i) => (
          <circle key={`d-${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth={2}>
            <title>{`${p.date}: ${p.count} completed`}</title>
          </circle>
        ))}

        {lastCreated && (
          <text x={lastCreated.x + 6} y={lastCreated.y} dominantBaseline="middle" fill="var(--color-text-secondary)" className="text-[10px] font-medium">
            {lastCreated.count}
          </text>
        )}
        {lastCompleted && (
          <text x={lastCompleted.x + 6} y={lastCompleted.y} dominantBaseline="middle" fill="var(--color-text-secondary)" className="text-[10px] font-medium">
            {lastCompleted.count}
          </text>
        )}
      </svg>

      <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-workspace-northpeak)' }} />
          Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
          Completed
        </span>
      </div>
    </div>
  );
}
