'use client';

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface BarChartEntry {
  label: string;
  count: number;
}

interface HorizontalBarChartProps {
  data: BarChartEntry[];
  emptyLabel: string;
}

interface Row extends BarChartEntry {
  remaining: number;
}

function truncate(label: string, max = 16): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-border-subtle bg-white px-3 py-2 shadow-dropdown">
      <p className="text-xs font-semibold text-text-primary">{row.label}</p>
      <p className="text-xs text-text-secondary">
        <span className="font-semibold tabular-nums text-text-primary">{row.count}</span> tasks
      </p>
    </div>
  );
}

// Single hue by design: each bar is already identified by its own label,
// so a distinct color per bar would be decorative rather than informative.
export default function HorizontalBarChart({ data, emptyLabel }: HorizontalBarChartProps) {
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
          dataKey="label"
          type="category"
          width={112}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
          tickFormatter={(value: string) => truncate(value)}
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
