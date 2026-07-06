'use client';

import { useState } from 'react';
import type { GrowthPoint } from '@/types/admin.types';

interface GrowthChartProps {
  users: GrowthPoint[];
  organizations: GrowthPoint[];
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

// Same validated northpeak/brand pair as the org-facing analytics trend
// chart, now with the same crosshair + tooltip — no reason for the admin
// panel's own chart to be less legible than the customer-facing one.
export default function GrowthChart({ users, organizations }: GrowthChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxCount = Math.max(1, ...users.map((p) => p.count), ...organizations.map((p) => p.count));
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = users.length > 1 ? plotWidth / (users.length - 1) : 0;

  const toPoints = (series: GrowthPoint[]) =>
    series.map((p, i) => ({
      x: PADDING_LEFT + i * stepX,
      y: PADDING_TOP + plotHeight - (p.count / maxCount) * plotHeight,
      count: p.count,
      date: p.date,
    }));

  const userPoints = toPoints(users);
  const orgPoints = toPoints(organizations);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => PADDING_TOP + plotHeight * t);
  const lastUser = userPoints[userPoints.length - 1];
  const lastOrg = orgPoints[orgPoints.length - 1];

  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const index = stepX > 0 ? Math.round((relX - PADDING_LEFT) / stepX) : 0;
    setHoverIndex(Math.min(Math.max(index, 0), userPoints.length - 1));
  };

  const hoveredUser = hoverIndex !== null ? userPoints[hoverIndex] : null;
  const hoveredOrg = hoverIndex !== null ? orgPoints[hoverIndex] : null;
  const tooltipLeftPct = hoveredUser ? (hoveredUser.x / WIDTH) * 100 : 0;
  const tooltipAlignRight = tooltipLeftPct > 65;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label="New users and organizations per day"
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

          {hoveredUser && (
            <line
              x1={hoveredUser.x}
              x2={hoveredUser.x}
              y1={PADDING_TOP}
              y2={HEIGHT - PADDING_BOTTOM}
              stroke="var(--color-border-muted)"
              strokeWidth={1}
            />
          )}

          <path d={buildAreaPath(userPoints, HEIGHT - PADDING_BOTTOM)} fill="var(--color-workspace-northpeak)" fillOpacity={0.08} stroke="none" />
          <path d={buildAreaPath(orgPoints, HEIGHT - PADDING_BOTTOM)} fill="var(--color-brand)" fillOpacity={0.1} stroke="none" />

          <path
            d={buildPath(userPoints)}
            fill="none"
            stroke="var(--color-workspace-northpeak)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={buildPath(orgPoints)}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {userPoints.map((p, i) => (
            <circle
              key={`u-${i}`}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 5 : 4}
              fill="var(--color-workspace-northpeak)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              className="transition-[r]"
            />
          ))}
          {orgPoints.map((p, i) => (
            <circle
              key={`o-${i}`}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 5 : 4}
              fill="var(--color-brand)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              className="transition-[r]"
            />
          ))}

          {lastUser && (
            <text x={lastUser.x + 6} y={lastUser.y} dominantBaseline="middle" fill="var(--color-text-secondary)" className="text-[10px] font-medium">
              {lastUser.count}
            </text>
          )}
          {lastOrg && (
            <text x={lastOrg.x + 6} y={lastOrg.y} dominantBaseline="middle" fill="var(--color-text-secondary)" className="text-[10px] font-medium">
              {lastOrg.count}
            </text>
          )}

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

        {hoveredUser && hoveredOrg && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[170px] rounded-md border border-border-subtle bg-white px-3 py-2 shadow-dropdown"
            style={{
              left: `${tooltipLeftPct}%`,
              transform: tooltipAlignRight ? 'translateX(-100%)' : 'translateX(12px)',
            }}
          >
            <p className="text-xs font-semibold text-text-primary">{formatDate(hoveredUser.date)}</p>
            <div className="mt-1.5 flex flex-col gap-1">
              <span className="flex items-center justify-between gap-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-workspace-northpeak)' }} />
                  New users
                </span>
                <span className="font-semibold tabular-nums text-text-primary">{hoveredUser.count}</span>
              </span>
              <span className="flex items-center justify-between gap-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
                  New organizations
                </span>
                <span className="font-semibold tabular-nums text-text-primary">{hoveredOrg.count}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-workspace-northpeak)' }} />
          New users
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
          New organizations
        </span>
      </div>
    </div>
  );
}
