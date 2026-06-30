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
import {
  ArrowRight, Archive, Building2, CalendarDays,
  Crown, FolderOpen, Loader2, Lock, Save, Shield, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { OrgOverviewSkeleton } from '@/components/shared/skeletons/OrgOverviewSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';

const MEMBER_COLORS = ['#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d'];
function getMemberColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
}

function MemberAvatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const cls = `h-${size} w-${size} rounded-full object-cover`;
  if (url) return <img src={url} alt={name} className={cls} />;
  return (
    <div
      className={cn(cls, 'flex shrink-0 items-center justify-center text-white font-bold')}
      style={{ backgroundColor: getMemberColor(name), fontSize: size * 1.5 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default function OrgOverviewPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const { setCurrentOrg } = useOrgStore();

  const { data: org, isLoading, error, refetch } = useOrganizationBySlug(slug);
  const { data: members = [] } = useOrganizationMembers(org?.id ?? '');
  const { data: projects = [] } = useOrgProjects(org?.id ?? '');
  const updateOrg = useUpdateOrganization(org?.id ?? '');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateOrgInput>({
    resolver: zodResolver(updateOrgSchema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (org) {
      reset({ name: org.name, description: org.description ?? '' });
    }
  }, [org, reset]);

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

  const isAdmin = org.ownerId === user?.id || members.some((m) => m.userId === user?.id && m.role === 'ORG_ADMIN');
  const owner = members.find((m) => m.userId === org.ownerId);
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const archivedProjects = projects.filter((p) => p.status === 'ARCHIVED');
  const admins = members.filter((m) => m.role === 'ORG_ADMIN' || m.userId === org.ownerId);

  const onSubmit = handleSubmit((data) => {
    updateOrg.mutate(
      { name: data.name, description: data.description || null },
      {
        onSuccess: (updated) => {
          toast.success('Workspace updated');
          setCurrentOrg(updated);
          if (updated.slug !== slug) {
            router.push(`/org/${updated.slug}`);
          }
        },
        onError: (err) => toast.error(parseApiError(err).message),
      }
    );
  });

  return (
    <div className="space-y-6">

      {/* ── Hero header ───────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-8 text-primary-text shadow-md">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 text-primary-text ring-1 ring-white/20">
              {org.logoUrl
                ? <img src={org.logoUrl} alt={org.name} className="h-14 w-14 rounded-xl object-cover" />
                : <Building2 size={26} />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{org.name}</h1>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/20 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    <Shield size={10} /> Admin
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-primary-text/60">/{org.slug}</p>
              {org.description && (
                <p className="mt-1.5 max-w-lg text-sm text-primary-text/80 leading-relaxed">{org.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/org/${slug}/projects`)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-medium text-primary-text hover:bg-white/20 transition-colors"
            >
              <FolderOpen size={13} /> Projects
            </button>
            <button
              onClick={() => router.push(`/org/${slug}/members`)}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-primary hover:bg-brand-hover transition-colors"
            >
              <Users size={13} /> Members
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Members"
          value={members.length}
          icon={<Users size={16} className="text-brand" />}
          sub={`${admins.length} admin${admins.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Active Projects"
          value={activeProjects.length}
          icon={<FolderOpen size={16} className="text-brand" />}
          sub="currently running"
          onClick={() => router.push(`/org/${slug}/projects`)}
        />
        <StatCard
          label="Archived"
          value={archivedProjects.length}
          icon={<Archive size={16} className="text-brand" />}
          sub="completed projects"
        />
      </div>

      {/* ── Projects + Members ────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Recent active projects — 3/5 */}
        <div className="lg:col-span-3 rounded-xl border border-border-subtle bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">Active Projects</h2>
            <button
              onClick={() => router.push(`/org/${slug}/projects`)}
              className="flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-hover transition-colors"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>

          {activeProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-text-muted">
              <FolderOpen size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No active projects yet</p>
              <p className="text-xs mt-0.5">Create your first project to get started</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {activeProjects.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => router.push(`/org/${slug}/projects/${p.id}`)}
                    className="group flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-surface-muted transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                      <FolderOpen size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{p.name}</p>
                      {p.description && (
                        <p className="truncate text-[11px] text-text-muted mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-text-muted">
                      <CalendarDays size={11} />
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <ArrowRight size={13} className="shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Member roster — 2/5 */}
        <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">Team</h2>
            <button
              onClick={() => router.push(`/org/${slug}/members`)}
              className="flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-hover transition-colors"
            >
              Manage <ArrowRight size={11} />
            </button>
          </div>

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-text-muted">
              <Users size={32} className="mb-3 opacity-20" />
              <p className="text-sm">No members yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {members.slice(0, 7).map((m) => {
                const name = m.user?.name ?? 'Unknown';
                const isOwner = m.userId === org.ownerId;
                const isOrgAdmin = m.role === 'ORG_ADMIN';
                return (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <MemberAvatar name={name} url={m.user?.avatarUrl} size={8} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {name}
                        {m.userId === user?.id && (
                          <span className="ml-1.5 text-[10px] text-text-muted font-normal">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-text-muted">{m.user?.email}</p>
                    </div>
                    {isOwner ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                        <Crown size={9} /> Owner
                      </span>
                    ) : isOrgAdmin ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Shield size={9} /> Admin
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                        Member
      </span>
                    )}
                  </li>
                );
              })}
              {members.length > 7 && (
                <li className="px-5 py-3 text-[11px] text-text-muted">
                  +{members.length - 7} more member{members.length - 7 !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* ── Workspace settings ────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-white p-6 shadow-card">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-text-primary">
            Workspace Settings
            {!isAdmin && (
              <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                <Lock size={10} /> Read Only
              </span>
            )}
          </h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="org-name" className="text-xs font-semibold text-text-secondary">Name</label>
              <Input
                id="org-name"
                disabled={!isAdmin || updateOrg.isPending}
                className="max-w-md"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="org-description" className="text-xs font-semibold text-text-secondary">Description</label>
              <textarea
                id="org-description"
                disabled={!isAdmin || updateOrg.isPending}
                placeholder="Optional description"
                rows={3}
                className="w-full max-w-md rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none disabled:opacity-50 resize-none"
                {...register('description')}
              />
            </div>
            {isAdmin && (
              <Button type="submit" disabled={updateOrg.isPending}>
                {updateOrg.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  : <><Save size={14} className="mr-2" />Save Changes</>
                }
              </Button>
            )}
          </form>
        </div>

        {/* About card */}
        <div className="rounded-xl border border-border-subtle bg-white p-6 shadow-card space-y-5">
          <h3 className="text-sm font-semibold text-text-primary">About</h3>
          <InfoRow label="Created">
            {new Date(org.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </InfoRow>
          <InfoRow label="Owner">
            {owner?.user ? (
              <div className="flex items-center gap-2 mt-1">
                <MemberAvatar name={owner.user.name} url={owner.user.avatarUrl} size={6} />
                <span>{owner.user.name}{owner.userId === user?.id ? ' (you)' : ''}</span>
              </div>
            ) : (
              org.ownerId === user?.id ? 'You' : '—'
            )}
          </InfoRow>
          <InfoRow label="Slug">/{org.slug}</InfoRow>
          <InfoRow label="Status">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
              Active
            </span>
          </InfoRow>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function StatCard({
  label, value, icon, sub, onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  sub?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'group rounded-xl border border-border-subtle bg-white p-5 shadow-card text-left w-full',
        onClick && 'hover:border-brand/40 hover:shadow-md transition-all cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold text-text-primary">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-text-muted">{sub}</p>}
    </Tag>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-1 text-sm font-medium text-text-secondary">{children}</div>
    </div>
  );
}
