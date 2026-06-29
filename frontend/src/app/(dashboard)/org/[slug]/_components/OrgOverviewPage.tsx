'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOrganizationBySlug, useOrganizationMembers, useUpdateOrganization } from '@/hooks/useOrganization';
import { useOrgProjects } from '@/hooks/useProject';
import { parseApiError } from '@/lib/axios';
import { useOrgStore } from '@/store/org.store';
import { useAuthStore } from '@/store/auth.store';
import { updateOrgSchema, UpdateOrgInput } from '@/schemas/organization.schema';
import { toast } from 'sonner';
import { ArrowRight, Building2, FolderOpen, Loader2, Lock, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrgOverviewSkeleton } from '@/components/shared/skeletons/OrgOverviewSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function OrgOverviewPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentOrg, setCurrentOrg } = useOrgStore();

  const { data: org, isLoading, error, refetch } = useOrganizationBySlug(slug);
  const { data: members } = useOrganizationMembers(org?.id ?? '');
  const { data: projects } = useOrgProjects(org?.id ?? '');
  const updateOrg = useUpdateOrganization(org?.id ?? '');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateOrgInput>({
    resolver: zodResolver(updateOrgSchema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (org) {
      reset({ name: org.name, description: org.description ?? '' });
      if (currentOrg?.id === org.id && currentOrg.slug !== org.slug) {
        setCurrentOrg(org);
      }
    }
  }, [org, currentOrg, setCurrentOrg, reset]);

  if (isLoading) return <OrgOverviewSkeleton />;

  if (error || !org) {
    return (
      <ErrorState
        title="Failed to load workspace"
        message="The workspace may not exist, or you might not have access to it."
        onRetry={() => refetch()}
      />
    );
  }

  const isAdmin = org.ownerId === user?.id || members?.some((m) => m.userId === user?.id && m.role === 'ORG_ADMIN');

  const onSubmit = handleSubmit((data) => {
    updateOrg.mutate(
      { name: data.name, description: data.description || null },
      {
        onSuccess: (updated) => {
          toast.success('Organization updated successfully');
          setCurrentOrg(updated);
        },
        onError: (err) => toast.error(parseApiError(err).message),
      }
    );
  });

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-white p-6 shadow-card">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/5 blur-3xl" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-text-primary">{org.name}</h1>
              <p className="text-xs text-text-muted mt-0.5">Slug: {org.slug}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Total Members</span>
            <Users size={16} className="text-brand" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{members?.length || 0}</p>
        </div>

        <button
          onClick={() => router.push(`/org/${slug}/projects`)}
          className="group rounded-xl border border-border-subtle bg-white p-5 shadow-card text-left transition-all hover:border-border hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Active Projects</span>
            <FolderOpen size={16} className="text-brand" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {projects?.filter((p) => p.status === 'ACTIVE').length ?? 0}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-brand opacity-0 group-hover:opacity-100 transition-opacity">
            View all <ArrowRight size={11} />
          </p>
        </button>
      </div>

      {/* Settings + Info */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
            Workspace Settings
            {!isAdmin && (
              <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                <Lock size={10} /> Read Only
              </span>
            )}
          </h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="org-name" className="text-xs font-semibold text-text-secondary">
                Organization Name
              </label>
              <Input
                id="org-name"
                disabled={!isAdmin || updateOrg.isPending}
                className="max-w-md focus:border-brand focus:ring-brand/20"
                {...register('name')}
              />
              {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="org-description" className="text-xs font-semibold text-text-secondary">
                Description
              </label>
              <textarea
                id="org-description"
                disabled={!isAdmin || updateOrg.isPending}
                placeholder="Optional description of the workspace"
                rows={3}
                className="w-full max-w-md rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:shadow-brand focus:outline-none disabled:opacity-50"
                {...register('description')}
              />
            </div>

            {isAdmin && (
              <Button type="submit" disabled={updateOrg.isPending} className="mt-2">
                {updateOrg.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  <><Save size={14} className="mr-2" />Save Changes</>
                )}
              </Button>
            )}
          </form>
        </div>

        <div className="rounded-xl border border-border-subtle bg-white p-6 shadow-card space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">About this workspace</h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-text-muted">Created</span>
              <p className="font-medium text-text-secondary mt-0.5">{new Date(org.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-text-muted">Owner</span>
              <p className="font-medium text-text-secondary mt-0.5">{org.ownerId === user?.id ? 'You' : 'Another User'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
