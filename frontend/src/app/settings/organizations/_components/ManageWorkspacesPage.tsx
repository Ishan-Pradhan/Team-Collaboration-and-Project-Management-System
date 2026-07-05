'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { useMyOrganizations } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';
import { useOrgStore } from '@/store/org.store';
import { avatarColor } from '@/lib/avatarColor';
import { Input } from '@/components/ui/input';
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
}: {
  org: Organization;
  isOwner: boolean;
  onEnter: () => void;
}) {
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
      <span className="text-xs font-medium text-muted-foreground shrink-0 pr-4">
        {isOwner ? 'Owner' : 'Member'}
      </span>
    </div>
  );
}

export default function ManageWorkspacesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);

  const [search, setSearch] = useState('');

  const { data: organizations, isLoading } = useMyOrganizations();

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
            />
          ))
        )}
      </div>
    </div>
  );
}
