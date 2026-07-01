'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgDashboard } from '@/hooks/useProject';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import {
  FolderOpen, CheckSquare, AlertTriangle, Clock,
  ArrowRight, MessageSquare, CalendarDays, Plus, ArrowRightLeft, UserPlus,
} from 'lucide-react';
import { ErrorState } from '@/components/shared/ErrorState';
import type { DashboardData } from '@/types/project.types';

// ─── Colors ──────────────────────────────────────────────────

const PROJECT_COLORS = [
  { bg: '#FFE4D6', text: '#C4532A' },
  { bg: '#E8E0FF', text: '#5B4FB5' },
  { bg: '#D4F5E4', text: '#1D7A4E' },
  { bg: '#D9EEFF', text: '#2D72B8' },
  { bg: '#FFF3D6', text: '#A67C00' },
  { bg: '#FFD6E8', text: '#B52D6B' },
];

const MEMBER_COLORS = ['#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d'];

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-success-soft text-success',
  MEDIUM: 'bg-warning-soft text-warning',
  HIGH: 'bg-danger-soft text-danger',
  CRITICAL: 'bg-[#e8c0c0] text-[#8e2f2f]',
};

// ─── Helpers ─────────────────────────────────────────────────

function getMemberColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
}

function getDueDateInfo(dueDate: string | null) {
  if (!dueDate) return null;
  const due = new Date(dueDate + 'T12:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, className: 'text-danger' };
  if (diffDays === 0) return { label: 'Due today', className: 'text-warning' };
  if (diffDays === 1) return { label: 'Due tomorrow', className: 'text-warning' };
  return { label: `${diffDays}d left`, className: 'text-text-muted' };
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Avatar ──────────────────────────────────────────────────

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const sz = `h-${size} w-${size}`;
  if (url) return <img src={url} alt={name} className={cn(sz, 'rounded-full object-cover shrink-0')} />;
  return (
    <div
      className={cn(sz, 'rounded-full flex shrink-0 items-center justify-center text-white font-semibold')}
      style={{ backgroundColor: getMemberColor(name), fontSize: size * 1.75 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-2xl bg-surface-muted" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-surface-muted" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 h-72 rounded-xl bg-surface-muted" />
        <div className="lg:col-span-2 h-72 rounded-xl bg-surface-muted" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 h-72 rounded-xl bg-surface-muted" />
        <div className="lg:col-span-2 h-72 rounded-xl bg-surface-muted" />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>;
}

export default function OrgOverviewPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: org } = useOrganizationBySlug(slug);
  const { data: dashboard, isLoading, error, refetch } = useOrgDashboard(org?.id ?? '');

  if (isLoading || !org) return <DashboardSkeleton />;

  if (error || !dashboard) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message="Something went wrong while fetching your dashboard data."
        onRetry={() => refetch()}
      />
    );
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">

      {/* ── Welcome banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-7 text-primary-text">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-primary-text/60">{greeting},</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{firstName}!</h1>
          <p className="mt-1 text-sm text-primary-text/70">
            Here&apos;s what&apos;s happening in <span className="font-semibold text-primary-text/90">{org.name}</span>
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="My Projects"
          value={dashboard.stats.projectCount}
          icon={<FolderOpen size={18} className="text-brand" />}
          onClick={() => router.push(`/org/${slug}/projects`)}
        />
        <StatCard
          label="Assigned Tasks"
          value={dashboard.stats.assignedTaskCount}
          icon={<CheckSquare size={18} className="text-primary" />}
        />
        <StatCard
          label="Overdue"
          value={dashboard.stats.overdueCount}
          icon={<AlertTriangle size={18} className="text-danger" />}
          highlight={dashboard.stats.overdueCount > 0}
        />
        <StatCard
          label="Due This Week"
          value={dashboard.stats.dueSoonCount}
          icon={<Clock size={18} className="text-warning" />}
        />
      </div>

      {/* ── Assigned Tasks + My Projects ── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Assigned Tasks — 3/5 */}
        <div className="lg:col-span-3 rounded-xl border border-border-subtle bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">Assigned Tasks</h2>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
              {dashboard.assignedTasks.length}
            </span>
          </div>

          {dashboard.assignedTasks.length === 0 ? (
            <EmptyState icon={<CheckSquare size={28} />} message="No tasks assigned to you" />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {dashboard.assignedTasks.map((task) => {
                const due = getDueDateInfo(task.dueDate);
                return (
                  <li key={task.id}>
                    <button
                      onClick={() => router.push(`/org/${slug}/projects/${task.projectId}?taskId=${task.id}`)}
                      className="group flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-surface-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                          {task.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-text-muted">{task.projectName}</span>
                          <span className="text-text-muted/40">·</span>
                          <span className="text-[11px] text-text-muted">{task.columnName}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', PRIORITY_STYLES[task.priority])}>
                          {task.priority}
                        </span>
                        {due && (
                          <span className={cn('flex items-center gap-1 text-[11px] font-medium', due.className)}>
                            <CalendarDays size={11} />
                            {due.label}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* My Projects — 2/5 */}
        <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">My Projects</h2>
            <button
              onClick={() => router.push(`/org/${slug}/projects`)}
              className="flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-hover transition-colors"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>

          {dashboard.myProjects.length === 0 ? (
            <EmptyState icon={<FolderOpen size={28} />} message="Not a member of any project yet" />
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4">
              {dashboard.myProjects.slice(0, 6).map((project, idx) => {
                const color = PROJECT_COLORS[idx % PROJECT_COLORS.length];
                return (
                  <button
                    key={project.id}
                    onClick={() => router.push(`/org/${slug}/projects/${project.id}`)}
                    className="group flex flex-col gap-2.5 rounded-lg border border-border-subtle p-3 text-left hover:border-border-muted hover:shadow-card transition-all"
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary leading-snug">
                        {project.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {project.dueSoonCount > 0
                          ? `${project.dueSoonCount} task${project.dueSoonCount !== 1 ? 's' : ''} due soon`
                          : 'No tasks due soon'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity + Team ── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Recent Activity — 3/5 */}
        <div className="lg:col-span-3 rounded-xl border border-border-subtle bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">Recent Activity</h2>
          </div>

          {dashboard.recentActivity.length === 0 ? (
            <EmptyState icon={<MessageSquare size={28} />} message="No recent activity in your projects" />
          ) : (
            <ul className="divide-y divide-border-subtle max-h-[340px] overflow-y-auto">
              {dashboard.recentActivity.map((item) => (
                <ActivityItem key={item.id} item={item} slug={slug} router={router} />
              ))}
            </ul>
          )}
        </div>

        {/* Team Members — 2/5 */}
        <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">
              People
              <span className="ml-1.5 text-text-muted font-normal">({dashboard.members.length})</span>
            </h2>
            <button
              onClick={() => router.push(`/org/${slug}/members`)}
              className="flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-hover transition-colors"
            >
              Manage <ArrowRight size={11} />
            </button>
          </div>

          {dashboard.members.length === 0 ? (
            <EmptyState icon={<FolderOpen size={28} />} message="No members yet" />
          ) : (
            <div className="grid grid-cols-3 gap-3 p-4 max-h-[340px] overflow-y-auto">
              {dashboard.members.map((member) => (
                <div key={member.id} className="flex flex-col items-center gap-1.5 rounded-lg border border-border-subtle p-3 text-center">
                  <Avatar name={member.name} url={member.avatarUrl} size={10} />
                  <div className="w-full min-w-0">
                    <p className="truncate text-[11px] font-semibold text-text-primary">{member.name}</p>
                    <p className="truncate text-[10px] text-text-muted">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function StatCard({
  label, value, icon, onClick, highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'group rounded-xl border bg-white p-5 shadow-card text-left w-full',
        highlight ? 'border-danger/30 bg-danger-soft/20' : 'border-border-subtle',
        onClick && 'hover:border-brand/40 hover:shadow-md transition-all cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className={cn('mt-3 text-3xl font-bold', highlight ? 'text-danger' : 'text-text-primary')}>
        {value}
      </p>
    </Tag>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-text-muted">
      <div className="mb-3 opacity-20">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

const ACTIVITY_META: Record<string, { icon: React.ReactNode; color: string }> = {
  task_created: { icon: <Plus size={11} />, color: 'text-success bg-success-soft' },
  task_moved: { icon: <ArrowRightLeft size={11} />, color: 'text-brand bg-brand-soft' },
  task_deleted: { icon: <AlertTriangle size={11} />, color: 'text-danger bg-danger-soft' },
  comment_added: { icon: <MessageSquare size={11} />, color: 'text-primary bg-surface-muted' },
  member_added: { icon: <UserPlus size={11} />, color: 'text-info bg-info-soft' },
};

function activityLabel(item: DashboardData['recentActivity'][number]): React.ReactNode {
  const { metadata } = item;
  const taskLink = metadata.taskId ? (
    <span className="font-semibold text-text-primary">{metadata.taskTitle}</span>
  ) : null;

  switch (item.type) {
    case 'task_created':
      return <>created task {taskLink}</>;
    case 'task_moved':
      return (
        <>
          moved {taskLink}{' '}
          {metadata.fromColumn && metadata.toColumn && (
            <span className="text-text-muted">
              {metadata.fromColumn} → {metadata.toColumn}
            </span>
          )}
        </>
      );
    case 'comment_added':
      return (
        <>
          commented on {taskLink}
          {metadata.content && (
            <span className="block mt-0.5 text-text-secondary line-clamp-1 font-normal">
              &ldquo;{metadata.content}&rdquo;
            </span>
          )}
        </>
      );
    case 'task_deleted':
      return (
        <>
          deleted task{' '}
          <span className="font-semibold text-text-primary line-through">{metadata.taskTitle}</span>
        </>
      );
    case 'member_added':
      return <>joined the project</>;
    default:
      return null;
  }
}

function ActivityItem({
  item,
  slug,
  router,
}: {
  item: DashboardData['recentActivity'][number];
  slug: string;
  router: ReturnType<typeof useRouter>;
}) {
  const meta = ACTIVITY_META[item.type] ?? ACTIVITY_META['task_created'];
  const taskId = item.type !== 'task_deleted' ? item.metadata.taskId : undefined;

  return (
    <li className="px-5 py-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-text-muted">
        <FolderOpen size={11} />
        <button
          onClick={() => router.push(`/org/${slug}/projects/${item.projectId}`)}
          className="font-medium hover:text-primary transition-colors"
        >
          {item.projectName}
        </button>
      </div>
      <div className="flex items-start gap-2.5">
        <Avatar name={item.actor.name} url={item.actor.avatarUrl} size={7} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-xs font-semibold text-text-primary">{item.actor.name}</span>
            <span
              className={cn('inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium', meta.color)}
            >
              {meta.icon}
            </span>
            <span
              className="text-xs text-text-secondary cursor-pointer hover:text-primary transition-colors"
              onClick={() => taskId && router.push(`/org/${slug}/projects/${item.projectId}?taskId=${taskId}`)}
            >
              {activityLabel(item)}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-text-muted">{formatRelativeTime(item.createdAt)}</p>
        </div>
      </div>
    </li>
  );
}
