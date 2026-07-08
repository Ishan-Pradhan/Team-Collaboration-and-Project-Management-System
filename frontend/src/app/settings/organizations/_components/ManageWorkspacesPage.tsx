'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, LogOut, MoreHorizontal, Search, Settings, Users } from 'lucide-react';
import { useMyOrganizations, useLeaveOrganization } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';
import { useOrgStore } from '@/store/org.store';
import { avatarColor } from '@/lib/avatarColor';
import { parseApiError } from '@/lib/axios';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { Organization } from '@/types/organization.types';

function OrgAvatar({ name }: { name: string }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function WorkspaceRow({
  org,
  isOwner,
  onEnter,
  onOpenSettings,
  onOpenMembers,
  onRequestLeave,
}: {
  org: Organization;
  isOwner: boolean;
  onEnter: () => void;
  onOpenSettings: () => void;
  onOpenMembers: () => void;
  onRequestLeave: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [menuOpen]);

  return (
    <div className="flex w-full items-center rounded-lg border border-border bg-card transition-all duration-150 hover:border-primary/25 hover:bg-primary/5">
      <button
        onClick={onEnter}
        className="flex flex-1 min-w-0 items-center gap-3 px-4 py-3.5 text-left"
      >
        <OrgAvatar name={org.name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-snug">{org.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{org.slug}</p>
        </div>
      </button>
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        {isOwner ? 'Owner' : 'Member'}
      </span>
      <div ref={menuRef} className="relative shrink-0 pl-2 pr-3">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border-subtle bg-surface py-1 shadow-lg">
            <button
              onClick={() => { onOpenSettings(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-muted transition-colors"
            >
              <Settings size={13} className="text-text-muted" /> Settings
            </button>
            <button
              onClick={() => { onOpenMembers(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-muted transition-colors"
            >
              <Users size={13} className="text-text-muted" /> Members
            </button>
            {!isOwner && (
              <>
                <div className="mx-2 my-0.5 border-t border-border-subtle" />
                <button
                  onClick={() => { onRequestLeave(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft/20 transition-colors"
                >
                  <LogOut size={13} /> Leave workspace
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManageWorkspacesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentOrg, setCurrentOrg, clearCurrentOrg } = useOrgStore();

  const [search, setSearch] = useState('');
  const [leaveTarget, setLeaveTarget] = useState<Organization | null>(null);

  const { data: organizations, isLoading } = useMyOrganizations();
  const leaveMutation = useLeaveOrganization(leaveTarget?.id ?? '');

  const filtered = useMemo(() => {
    if (!organizations) return [];
    if (!search.trim()) return organizations;
    const q = search.toLowerCase();
    return organizations.filter(
      (o) => o.name.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q)
    );
  }, [organizations, search]);

  const handleEnter = (org: Organization) => {
    setCurrentOrg(org);
    router.push(`/org/${org.slug}`);
  };

  const confirmLeave = () => {
    if (!leaveTarget) return;
    leaveMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(`You have left ${leaveTarget.name}`);
        if (currentOrg?.id === leaveTarget.id) clearCurrentOrg();
        setLeaveTarget(null);
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-foreground tracking-tight mb-1">Manage Workspaces</h1>
        <p className="text-sm text-muted-foreground">Switch workspaces, or manage your membership in each.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
        <Input
          id="manage-workspace-search"
          placeholder="Search workspace"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {search ? 'No workspaces match your search.' : "You don't belong to any workspace yet."}
          </p>
        ) : (
          filtered.map((org) => (
            <WorkspaceRow
              key={org.id}
              org={org}
              isOwner={org.ownerId === user?.id}
              onEnter={() => handleEnter(org)}
              onOpenSettings={() => router.push(`/org/${org.slug}/settings`)}
              onOpenMembers={() => router.push(`/org/${org.slug}/members`)}
              onRequestLeave={() => setLeaveTarget(org)}
            />
          ))
        )}
      </div>

      <ConfirmationDialog
        isOpen={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        onConfirm={confirmLeave}
        title="Leave Workspace"
        description={`Leave ${leaveTarget?.name}? You'll need to be invited back to rejoin.`}
        confirmText="Leave"
        isDestructive
        isLoading={leaveMutation.isPending}
      />
    </div>
  );
}
