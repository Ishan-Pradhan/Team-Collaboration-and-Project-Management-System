'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldMinus, ShieldPlus } from 'lucide-react';
import { useAdminUsers, useToggleBlockUser, usePromoteUser, useDemoteUser } from '@/hooks/useAdmin';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { AdminUser } from '@/types/admin.types';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers({ page, limit: 20, search });

  const toggleBlock = useToggleBlockUser();
  const promote = usePromoteUser();
  const demote = useDemoteUser();

  const [roleTarget, setRoleTarget] = useState<{ user: AdminUser; action: 'promote' | 'demote' } | null>(null);

  const handleToggleBlock = (userId: string) => {
    toggleBlock.mutate(userId, {
      onSuccess: () => toast.success('User status updated'),
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  const confirmRoleChange = () => {
    if (!roleTarget) return;
    const mutation = roleTarget.action === 'promote' ? promote : demote;
    mutation.mutate(roleTarget.user.id, {
      onSuccess: () => {
        toast.success(roleTarget.action === 'promote' ? 'User promoted to super admin' : 'User demoted to regular user');
        setRoleTarget(null);
      },
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Users</h1>
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-text-muted">Loading users…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
            {data.items.map((u) => (
              <div key={u.id} className="flex items-center justify-between border-b border-border-subtle px-4 py-3 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-text-primary">{u.name}</p>
                  <p className="text-xs text-text-muted">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.role === 'SUPER_ADMIN' && <Badge>Super Admin</Badge>}
                  {!u.isActive && <Badge variant="danger">Blocked</Badge>}
                  {u.id !== currentUser?.id && (
                    <>
                      <button
                        onClick={() => handleToggleBlock(u.id)}
                        className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
                      >
                        {u.isActive ? 'Block' : 'Unblock'}
                      </button>
                      <button
                        onClick={() => setRoleTarget({ user: u, action: u.role === 'SUPER_ADMIN' ? 'demote' : 'promote' })}
                        className="flex items-center gap-1 rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
                      >
                        {u.role === 'SUPER_ADMIN' ? <ShieldMinus size={13} /> : <ShieldPlus size={13} />}
                        {u.role === 'SUPER_ADMIN' ? 'Demote' : 'Promote'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {data.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-muted">No users found</p>
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

      <ConfirmationDialog
        isOpen={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        onConfirm={confirmRoleChange}
        title={roleTarget?.action === 'promote' ? 'Promote to Super Admin' : 'Demote to regular user'}
        description={
          roleTarget?.action === 'promote'
            ? `${roleTarget?.user.name} will gain full super admin access to this panel.`
            : `${roleTarget?.user.name} will lose super admin access.`
        }
        confirmText={roleTarget?.action === 'promote' ? 'Promote' : 'Demote'}
        isDestructive={roleTarget?.action === 'demote'}
        isLoading={promote.isPending || demote.isPending}
      />
    </div>
  );
}
