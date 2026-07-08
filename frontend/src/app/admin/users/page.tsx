'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShieldMinus, ShieldPlus, Users } from 'lucide-react';
import { useAdminUsers, useToggleBlockUser, usePromoteUser, useDemoteUser } from '@/hooks/useAdmin';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { avatarColor } from '@/lib/avatarColor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { AdminListSkeleton } from '@/components/shared/skeletons/AdminListSkeleton';
import type { AdminUser } from '@/types/admin.types';

function UserAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase text-white"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {name.charAt(0)}
    </span>
  );
}

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

  if (isLoading || !data) return <AdminListSkeleton rows={8} withToolbar />;

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

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
        {data.items.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 hover:bg-surface-hover transition-colors">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar name={u.name} url={u.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{u.name}</p>
                <p className="truncate text-xs text-text-muted">{u.email}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {u.role === 'SUPER_ADMIN' && <Badge>Super Admin</Badge>}
              {!u.isActive && <span className="badge-danger">Blocked</span>}
              {u.id !== currentUser?.id && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleToggleBlock(u.id)}>
                    {u.isActive ? 'Block' : 'Unblock'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setRoleTarget({ user: u, action: u.role === 'SUPER_ADMIN' ? 'demote' : 'promote' })}
                  >
                    {u.role === 'SUPER_ADMIN' ? <ShieldMinus size={13} /> : <ShieldPlus size={13} />}
                    {u.role === 'SUPER_ADMIN' ? 'Demote' : 'Promote'}
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
        {data.items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
              <Users className="text-text-muted" size={18} />
            </div>
            <p className="text-sm font-medium text-text-primary">No users found</p>
            <p className="mt-1 text-sm text-text-muted">Try a different name or email.</p>
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
