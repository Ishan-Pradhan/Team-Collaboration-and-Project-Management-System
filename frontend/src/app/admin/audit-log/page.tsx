'use client';

import { useState } from 'react';
import { useAuditLog } from '@/hooks/useAdmin';

const ACTION_LABELS: Record<string, string> = {
  user_blocked: 'Blocked user',
  user_unblocked: 'Unblocked user',
  user_promoted: 'Promoted user to Super Admin',
  user_demoted: 'Demoted user to regular user',
  org_suspended: 'Suspended organization',
  org_unsuspended: 'Unsuspended organization',
  feature_toggled: 'Toggled organization feature',
};

export default function AdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog({ page, limit: 25 });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Audit Log</h1>

      {isLoading || !data ? (
        <p className="text-sm text-text-muted">Loading audit log…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
            {data.items.map((entry) => (
              <div key={entry.id} className="border-b border-border-subtle px-4 py-3 last:border-b-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                  <p className="text-xs text-text-muted">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {entry.actor?.name ?? 'Unknown admin'} · target: {entry.targetType} {entry.targetId}
                  {entry.metadata ? ` · ${JSON.stringify(entry.metadata)}` : ''}
                </p>
              </div>
            ))}
            {data.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-muted">No admin actions yet</p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              Page {data.meta.currentPage} of {Math.max(1, data.meta.totalPages)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-border-subtle px-3 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-md border border-border-subtle px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
