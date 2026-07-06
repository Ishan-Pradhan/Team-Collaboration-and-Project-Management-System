'use client';

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

// Minimal by design: a native <title> per point is the hover layer here
// (no crosshair/tooltip component) — this is an internal 30-day admin
// chart, not a customer-facing one.
export default function GrowthChart({ users, organizations }: GrowthChartProps) {
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

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
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
          <circle key={`u-${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-workspace-northpeak)" stroke="var(--color-surface)" strokeWidth={2}>
            <title>{`${p.date}: ${p.count} new users`}</title>
          </circle>
        ))}
        {orgPoints.map((p, i) => (
          <circle key={`o-${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth={2}>
            <title>{`${p.date}: ${p.count} new organizations`}</title>
          </circle>
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
      </svg>

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
