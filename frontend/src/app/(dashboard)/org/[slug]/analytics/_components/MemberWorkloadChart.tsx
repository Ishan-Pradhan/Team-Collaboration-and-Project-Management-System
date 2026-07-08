'use client';

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { avatarColor } from '@/lib/avatarColor';
import type { MemberWorkloadEntry } from '@/types/analytics.types';

interface MemberWorkloadChartProps {
  data: MemberWorkloadEntry[];
  emptyLabel: string;
}

interface Row extends MemberWorkloadEntry {
  remaining: number;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="h-6 w-6 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold uppercase text-white"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {name.charAt(0)}
    </div>
  );
}

function AvatarTick({ x, y, index, rows }: { x?: number | string; y?: number | string; index?: number; rows: Row[] }) {
  const entry = index != null ? rows[index] : undefined;
  if (!entry) return <g />;
  return (
    <foreignObject x={Number(x ?? 0) - 140} y={Number(y ?? 0) - 12} width={140} height={24}>
      <div className="flex items-center gap-2">
        <Avatar name={entry.name} url={entry.avatarUrl} />
        <span className="truncate text-xs text-text-secondary" title={entry.name}>
          {entry.name}
        </span>
      </div>
    </foreignObject>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-border-subtle bg-surface px-3 py-2 shadow-dropdown">
      <p className="text-xs font-semibold text-text-primary">{row.name}</p>
      <p className="text-xs text-text-secondary">
        <span className="font-semibold tabular-nums text-text-primary">{row.count}</span> open tasks
      </p>
    </div>
  );
}

// Same-name members are common (two "Ishan Pradhan"s in one org) — the
// avatar, not the label, is what disambiguates them, so it leads each row.
export default function MemberWorkloadChart({ data, emptyLabel }: MemberWorkloadChartProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  const rows: Row[] = data.map((d) => ({ ...d, remaining: max - d.count }));

  return (
    <ResponsiveContainer width="100%" height={rows.length * 36}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={12}>
        <XAxis type="number" hide domain={[0, max]} />
        <YAxis
          dataKey="userId"
          type="category"
          width={148}
          tickLine={false}
          axisLine={false}
          tick={(props: { x?: number | string; y?: number | string; index?: number }) => <AvatarTick {...props} rows={rows} />}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-muted)' }} />
        <Bar dataKey="count" stackId="a" fill="var(--color-brand)" radius={[8, 0, 0, 8]} barSize={16} isAnimationActive={false} />
        <Bar dataKey="remaining" stackId="a" fill="var(--color-surface-muted)" radius={[0, 8, 8, 0]} barSize={16} isAnimationActive={false}>
          <LabelList
            dataKey="remaining"
            position="right"
            content={(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => {
              const x = Number(props.x ?? 0);
              const y = Number(props.y ?? 0);
              const width = Number(props.width ?? 0);
              const height = Number(props.height ?? 0);
              const entry = rows[props.index ?? 0];
              return (
                <text x={x + width + 8} y={y + height / 2 + 4} textAnchor="start" fill="var(--color-text-primary)" className="text-xs font-medium tabular-nums">
                  {entry.count}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
