'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GrowthPoint } from '@/types/admin.types';

interface GrowthChartProps {
  users: GrowthPoint[];
  organizations: GrowthPoint[];
}

interface ChartRow {
  date: string;
  users: number;
  organizations: number;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function endLabel(data: ChartRow[]) {
  return function EndLabel(props: { x?: number | string; y?: number | string; index?: number; value?: unknown }) {
    if (props.index !== data.length - 1 || props.value == null) return <g />;
    return (
      <text
        x={Number(props.x ?? 0) + 6}
        y={props.y}
        dy={4}
        fill="var(--color-text-secondary)"
        className="text-[10px] font-medium"
      >
        {String(props.value)}
      </text>
    );
  };
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const users = payload.find((p) => p.dataKey === 'users')?.value ?? 0;
  const organizations = payload.find((p) => p.dataKey === 'organizations')?.value ?? 0;

  return (
    <div className="min-w-[170px] rounded-md border border-border-subtle bg-white px-3 py-2 shadow-dropdown">
      <p className="text-xs font-semibold text-text-primary">{formatDate(label)}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        <span className="flex items-center justify-between gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-workspace-northpeak)' }} />
            New users
          </span>
          <span className="font-semibold tabular-nums text-text-primary">{users}</span>
        </span>
        <span className="flex items-center justify-between gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
            New organizations
          </span>
          <span className="font-semibold tabular-nums text-text-primary">{organizations}</span>
        </span>
      </div>
    </div>
  );
}

// Same validated northpeak/brand pair as the org-facing analytics trend
// chart, now with the same crosshair + tooltip — no reason for the admin
// panel's own chart to be less legible than the customer-facing one.
export default function GrowthChart({ users, organizations }: GrowthChartProps) {
  const data: ChartRow[] = users.map((p, i) => ({
    date: p.date,
    users: p.count,
    organizations: organizations[i]?.count ?? 0,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 16, right: 40, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border-subtle)" />
          <XAxis dataKey="date" hide />
          <YAxis hide domain={[0, (max: number) => Math.max(1, max)]} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border-muted)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="users"
            stroke="var(--color-workspace-northpeak)"
            strokeWidth={2}
            fill="var(--color-workspace-northpeak)"
            fillOpacity={0.08}
            dot={{ r: 4, fill: 'var(--color-workspace-northpeak)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: 'var(--color-workspace-northpeak)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
            label={endLabel(data)}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="organizations"
            stroke="var(--color-brand)"
            strokeWidth={2}
            fill="var(--color-brand)"
            fillOpacity={0.1}
            dot={{ r: 4, fill: 'var(--color-brand)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: 'var(--color-brand)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
            label={endLabel(data)}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

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
