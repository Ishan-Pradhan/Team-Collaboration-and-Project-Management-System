'use client';

import { avatarColor } from '@/lib/avatarColor';
import type { MemberWorkloadEntry } from '@/types/analytics.types';

interface MemberWorkloadChartProps {
  data: MemberWorkloadEntry[];
  emptyLabel: string;
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

// Same-name members are common (two "Ishan Pradhan"s in one org) — the
// avatar, not the label, is what disambiguates them, so it leads each row.
export default function MemberWorkloadChart({ data, emptyLabel }: MemberWorkloadChartProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="space-y-3">
      {data.map((entry) => (
        <div key={entry.userId} className="flex items-center gap-3">
          <Avatar name={entry.name} url={entry.avatarUrl} />
          <span className="w-24 shrink-0 truncate text-xs text-text-secondary" title={entry.name}>
            {entry.name}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
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
