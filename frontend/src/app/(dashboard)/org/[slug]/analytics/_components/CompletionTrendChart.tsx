'use client';

import { useState } from 'react';
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

function buildAreaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${buildPath(points)} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Validated color pair (see analytics dataviz pass): the northpeak/brand hues
// pass CVD separation; the gold's contrast-vs-surface WARN is offset by the
// legend + direct end labels + tooltip below, so it stays legible without a
// heavier stroke.
export default function CompletionTrendChart({ created, completed }: CompletionTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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

  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const index = stepX > 0 ? Math.round((relX - PADDING_LEFT) / stepX) : 0;
    setHoverIndex(Math.min(Math.max(index, 0), createdPoints.length - 1));
  };

  const hovered = hoverIndex !== null ? createdPoints[hoverIndex] : null;
  const hoveredCompleted = hoverIndex !== null ? completedPoints[hoverIndex] : null;
  const tooltipLeftPct = hovered ? (hovered.x / WIDTH) * 100 : 0;
  const tooltipAlignRight = tooltipLeftPct > 65;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full overflow-visible"
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

          {hovered && (
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PADDING_TOP}
              y2={HEIGHT - PADDING_BOTTOM}
              stroke="var(--color-border-muted)"
              strokeWidth={1}
            />
          )}

          <path d={buildAreaPath(createdPoints, HEIGHT - PADDING_BOTTOM)} fill="var(--color-workspace-northpeak)" fillOpacity={0.08} stroke="none" />
          <path d={buildAreaPath(completedPoints, HEIGHT - PADDING_BOTTOM)} fill="var(--color-brand)" fillOpacity={0.1} stroke="none" />

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
            <circle
              key={`c-${i}`}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 5 : 4}
              fill="var(--color-workspace-northpeak)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              className="transition-[r]"
            />
          ))}
          {completedPoints.map((p, i) => (
            <circle
              key={`d-${i}`}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 5 : 4}
              fill="var(--color-brand)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              className="transition-[r]"
            />
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

          {/* Hit-target overlay: the full plot area drives the crosshair, not the 4px points */}
          <rect
            x={PADDING_LEFT}
            y={0}
            width={plotWidth}
            height={HEIGHT}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>

        {hovered && hoveredCompleted && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[160px] rounded-md border border-border-subtle bg-white px-3 py-2 shadow-dropdown"
            style={{
              left: `${tooltipLeftPct}%`,
              transform: tooltipAlignRight ? 'translateX(-100%)' : 'translateX(12px)',
            }}
          >
            <p className="text-xs font-semibold text-text-primary">{formatDate(hovered.date)}</p>
            <div className="mt-1.5 flex flex-col gap-1">
              <span className="flex items-center justify-between gap-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-workspace-northpeak)' }} />
                  Created
                </span>
                <span className="font-semibold tabular-nums text-text-primary">{hovered.count}</span>
              </span>
              <span className="flex items-center justify-between gap-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
                  Completed
                </span>
                <span className="font-semibold tabular-nums text-text-primary">{hoveredCompleted.count}</span>
              </span>
            </div>
          </div>
        )}
      </div>

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
