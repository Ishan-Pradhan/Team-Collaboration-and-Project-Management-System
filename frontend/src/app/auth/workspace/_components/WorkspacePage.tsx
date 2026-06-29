'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Plus, Search, Users } from 'lucide-react';

import AuthSideBar from '@/components/shared/auth/AuthSideBar';
import Logo from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMyOrganizations, useCreateOrganization } from '@/hooks/useOrganization';
import { useOrgStore } from '@/store/org.store';
import type { Organization } from '@/types/organization.types';
import { cn } from '@/lib/utils';
import { parseApiError } from '@/lib/axios';

function getOrgColor(name: string): string {
  const colors = ['#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function OrgAvatar({ name }: { name: string }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
      style={{ backgroundColor: getOrgColor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function WorkspacePage() {
  const router = useRouter();
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);

  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: organizations, isLoading } = useMyOrganizations();
  const { mutate: createOrg, isPending: isCreating } = useCreateOrganization();

  const filtered = useMemo(() => {
    if (!organizations) return [];
    if (!search.trim()) return organizations;
    const q = search.toLowerCase();
    return organizations.filter(
      (o) => o.name.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q)
    );
  }, [organizations, search]);

  const handleSelect = (org: Organization) => {
    setSelecting(org.id);
    setCurrentOrg(org);
    setTimeout(() => router.push('/'), 350);
  };

  const handleCreate = () => {
    if (!newOrgName.trim()) return;
    setApiError(null);
    createOrg(newOrgName.trim(), {
      onSuccess: (org) => {
        setCurrentOrg(org);
        setShowCreate(false);
        setNewOrgName('');
        router.push('/');
      },
      onError: (err) => setApiError(parseApiError(err).message),
    });
  };

  return (
    <div className="min-h-screen flex bg-background w-full">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-10" />

          <h1 className="text-h1 text-foreground tracking-tight mb-1">Choose your workspace</h1>
          <p className="text-sm text-muted-foreground mb-6">Select a workspace to continue, or create a new one.</p>

          {apiError && (
            <div className="mb-6 p-3.5 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {apiError}
            </div>
          )}

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
            <Input
              id="workspace-search"
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
            ) : filtered.length === 0 && !showCreate ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search ? 'No workspaces match your search.' : "You don't belong to any workspace yet."}
              </p>
            ) : (
              filtered.map((org) => {
                const isSelecting = selecting === org.id;
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelect(org)}
                    disabled={!!selecting}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border text-left transition-all duration-150',
                      'hover:border-primary/25 hover:bg-primary/5',
                      isSelecting ? 'border-primary/40 bg-primary/8 shadow-sm' : 'border-border bg-card'
                    )}
                  >
                    <OrgAvatar name={org.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-snug">{org.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{org.slug}</p>
                    </div>
                    {isSelecting ? (
                      <Loader2 size={15} className="animate-spin text-primary flex-shrink-0" />
                    ) : (
                      <Check size={15} className="text-primary opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}

            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border border-border bg-card text-left hover:border-primary/25 hover:bg-primary/5 transition-all duration-150"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Plus size={15} className="text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">Create workspace</span>
              </button>
            ) : (
              <div className="px-4 py-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New workspace</p>
                <Input
                  placeholder="e.g. Acme Inc."
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setShowCreate(false); setNewOrgName(''); }
                  }}
                  className="h-10"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button className="flex-1 h-9 text-sm" onClick={handleCreate} disabled={!newOrgName.trim() || isCreating}>
                    {isCreating ? <Loader2 className="animate-spin" size={14} /> : 'Create'}
                  </Button>
                  <Button variant="outline" className="h-9 px-4 text-sm" onClick={() => { setShowCreate(false); setNewOrgName(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push('/settings/organizations')}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border border-border bg-card text-left hover:border-primary/25 hover:bg-primary/5 transition-all duration-150"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Users size={15} className="text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">Manage workspaces</span>
            </button>
          </div>
        </div>
      </div>
      <AuthSideBar />
    </div>
  );
}
