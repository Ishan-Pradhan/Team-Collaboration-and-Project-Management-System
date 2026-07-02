'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useUpdateOrganization, useDeleteOrganization } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';
import { useOrgStore } from '@/store/org.store';
import { parseApiError } from '@/lib/axios';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/shared/ErrorState';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function SettingsPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const { clearCurrentOrg } = useOrgStore();

  const { data: org, isLoading, error, refetch } = useOrganizationBySlug(slug);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (org) {
      setName(org.name);
      setDescription(org.description ?? '');
    }
  }, [org]);

  const updateMutation = useUpdateOrganization(org?.id ?? '');
  const deleteMutation = useDeleteOrganization();

  if (isLoading) return null;
  if (error || !org) {
    return (
      <ErrorState
        title="Workspace not found"
        message="This workspace does not exist or you don't have access."
        onRetry={() => refetch()}
      />
    );
  }

  const isOwner = org.ownerId === user?.id;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateMutation.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => toast.success('Workspace updated'),
        onError: (err) => toast.error(parseApiError(err).message),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm(`Permanently delete "${org.name}"? This cannot be undone. All projects, tasks, and members will be removed.`)) return;
    deleteMutation.mutate(org.id, {
      onSuccess: () => {
        toast.success('Workspace deleted');
        clearCurrentOrg();
        router.push('/auth/workspace');
      },
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">Manage Workspace</h1>
        <p className="mt-0.5 text-xs text-text-secondary">
          Configure your workspace settings and preferences.
        </p>
      </div>

      {/* General settings — admin + owner */}
      <section className="rounded-xl border border-border-subtle bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">General</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="ws-name">
              Workspace Name
            </label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="ws-desc">
              Description <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <textarea
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workspace do?"
              rows={3}
              className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-1.5">
              {updateMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </section>

      {/* Danger Zone — owner only */}
      {isOwner && (
        <section className="rounded-xl border border-danger/30 bg-danger-soft/10 p-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-danger" />
            <h2 className="text-sm font-semibold text-danger">Danger Zone</h2>
          </div>
          <p className="text-xs text-text-secondary mb-4">
            Permanently deletes this workspace, all its projects, tasks, and removes all members. This cannot be undone.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-white px-4 py-2 text-sm font-medium text-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete Workspace
          </button>
        </section>
      )}


    </div>
  );
}
