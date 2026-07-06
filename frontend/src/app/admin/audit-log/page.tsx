'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, Ban, ChevronLeft, ChevronRight, ScrollText, ShieldCheck, ShieldMinus, ShieldPlus, ToggleLeft } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { AdminListSkeleton } from '@/components/shared/skeletons/AdminListSkeleton';

const ACTION_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  user_blocked: { label: 'Blocked user', icon: Ban, color: 'var(--color-danger)' },
  user_unblocked: { label: 'Unblocked user', icon: ShieldCheck, color: 'var(--color-success)' },
  user_promoted: { label: 'Promoted user to Super Admin', icon: ShieldPlus, color: 'var(--color-brand)' },
  user_demoted: { label: 'Demoted user to regular user', icon: ShieldMinus, color: 'var(--color-text-muted)' },
  org_suspended: { label: 'Suspended organization', icon: Ban, color: 'var(--color-danger)' },
  org_unsuspended: { label: 'Unsuspended organization', icon: ShieldCheck, color: 'var(--color-success)' },
  feature_toggled: { label: 'Toggled organization feature', icon: ToggleLeft, color: 'var(--color-workspace-northpeak)' },
};
const DEFAULT_META = { icon: Activity, color: 'var(--color-text-muted)' };

function formatMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ');
}

export default function AdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog({ page, limit: 25 });

  if (isLoading || !data) return <AdminListSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Audit Log</h1>

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
        {data.items.map((entry) => {
          const meta = ACTION_META[entry.action] ?? DEFAULT_META;
          const Icon = meta.icon;
          const label = 'label' in meta ? meta.label : entry.action;
          const metadataText = formatMetadata(entry.metadata);

          return (
            <div key={entry.id} className="flex items-start gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: meta.color }}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <p className="shrink-0 text-xs text-text-muted">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-0.5 truncate text-xs text-text-secondary">
                  {entry.actor?.name ?? 'Unknown admin'} · target: {entry.targetType} {entry.targetId.slice(0, 8)}
                </p>
                {metadataText && <p className="mt-0.5 truncate text-xs text-text-muted">{metadataText}</p>}
              </div>
            </div>
          );
        })}
        {data.items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
              <ScrollText className="text-text-muted" size={18} />
            </div>
            <p className="text-sm font-medium text-text-primary">No admin actions yet</p>
            <p className="mt-1 text-sm text-text-muted">Actions taken in this panel will show up here.</p>
          </div>
        )}
      </div>

      {data.items.length > 0 && (
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>
            Page {data.meta.currentPage} of {Math.max(1, data.meta.totalPages)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1">
              <ChevronLeft size={14} />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1">
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
