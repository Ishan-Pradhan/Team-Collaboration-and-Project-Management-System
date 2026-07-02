'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgDashboard } from '@/hooks/useProject';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ArrowRight, CheckSquare,
  Clock, FolderOpen, MessageSquare, Plus, ArrowRightLeft, UserPlus,
} from 'lucide-react';
import { ErrorState } from '@/components/shared/ErrorState';
import type { DashboardData } from '@/types/project.types';

// ─── Helpers ─────────────────────────────────────────────────

const AVATAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-emerald-400',
  MEDIUM: 'bg-amber-400',
  HIGH: 'bg-orange-400',
  CRITICAL: 'bg-red-500',
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'text-emerald-600 bg-emerald-50',
  MEDIUM: 'text-amber-600 bg-amber-50',
  HIGH: 'text-orange-600 bg-orange-50',
  CRITICAL: 'text-red-600 bg-red-50',
};

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

function getDueDateLabel(dueDate: string | null): { label: string; cls: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + 'T12:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'text-red-500' };
  if (diff === 0) return { label: 'Due today', cls: 'text-amber-500' };
  if (diff <= 2) return { label: `${diff}d left`, cls: 'text-amber-500' };
  return { label: `${diff}d left`, cls: 'text-gray-400' };
}

// ─── Avatar ──────────────────────────────────────────────────

function Avatar({ name, url, size = 7 }: { name: string; url?: string | null; size?: number }) {
  const px = size * 4;
  const style = { width: px, height: px, fontSize: px * 0.38, flexShrink: 0 };
  if (url) return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={style} />;
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold uppercase shrink-0"
      style={{ ...style, backgroundColor: avatarColor(name) }}>
      {name.charAt(0)}
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────

function Section({
  title, count, action, children, className,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col rounded-xl bg-white border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{count}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-300">
      {icon}
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-16 w-64 rounded-lg bg-gray-100" />
      <div className="grid grid-cols-4 rounded-xl border border-gray-100 overflow-hidden divide-x divide-gray-100">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 h-64 rounded-xl bg-gray-100" />
        <div className="lg:col-span-2 h-64 rounded-xl bg-gray-100" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 h-64 rounded-xl bg-gray-100" />
        <div className="lg:col-span-2 h-64 rounded-xl bg-gray-100" />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

interface Props { params: Promise<{ slug: string }> }

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
        message="Something went wrong loading your dashboard."
        onRetry={() => refetch()}
      />
    );
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-400">{greeting},</p>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{firstName}</h1>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm text-gray-400">{today}</p>
          <p className="text-sm font-medium text-gray-600">{org.name}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-gray-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden divide-x divide-y sm:divide-y-0 divide-gray-100">
        <button
          onClick={() => router.push(`/org/${slug}/projects`)}
          className="flex flex-col gap-1 px-6 py-5 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <FolderOpen size={12} />
            Projects
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard.stats.projectCount}</p>
        </button>

        <div className="flex flex-col gap-1 px-6 py-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <CheckSquare size={12} />
            Assigned
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard.stats.assignedTaskCount}</p>
        </div>

        <div className="flex flex-col gap-1 px-6 py-5">
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide',
            dashboard.stats.overdueCount > 0 ? 'text-red-400' : 'text-gray-400',
          )}>
            <AlertTriangle size={12} />
            Overdue
          </div>
          <p className={cn('text-3xl font-bold', dashboard.stats.overdueCount > 0 ? 'text-red-500' : 'text-gray-900')}>
            {dashboard.stats.overdueCount}
          </p>
        </div>

        <div className="flex flex-col gap-1 px-6 py-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <Clock size={12} />
            Due Soon
          </div>
          <p className="text-3xl font-bold text-gray-900">{dashboard.stats.dueSoonCount}</p>
        </div>
      </div>

      {/* Row 1: Assigned tasks + My Projects */}
      <div className="grid gap-5 lg:grid-cols-5">

        <Section
          className="lg:col-span-3"
          title="Assigned to Me"
          count={dashboard.assignedTasks.length}
        >
          {dashboard.assignedTasks.length === 0 ? (
            <EmptyState icon={<CheckSquare size={28} />} label="You have no tasks assigned" />
          ) : (
            <ul className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
              {dashboard.assignedTasks.map((task) => {
                const due = getDueDateLabel(task.dueDate);
                return (
                  <li key={task.id}>
                    <button
                      onClick={() => router.push(`/org/${slug}/projects/${task.projectId}?taskId=${task.id}`)}
                      className="group flex w-full items-center gap-3.5 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[task.priority])} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800 group-hover:text-gray-600 transition-colors">
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {task.projectName}
                          <span className="mx-1.5 text-gray-200">·</span>
                          {task.columnName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('rounded px-1.5 py-0.5 text-[0.7rem] font-semibold', PRIORITY_LABEL[task.priority])}>
                          {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                        </span>
                        {due && (
                          <span className={cn('text-xs font-medium tabular-nums', due.cls)}>
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
        </Section>

        <Section
          className="lg:col-span-2"
          title="My Projects"
          action={
            <button
              onClick={() => router.push(`/org/${slug}/projects`)}
              className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              All <ArrowRight size={12} />
            </button>
          }
        >
          {dashboard.myProjects.length === 0 ? (
            <EmptyState icon={<FolderOpen size={28} />} label="You're not in any projects" />
          ) : (
            <ul className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
              {dashboard.myProjects.slice(0, 8).map((project) => (
                <li key={project.id}>
                  <button
                    onClick={() => router.push(`/org/${slug}/projects/${project.id}`)}
                    className="group flex w-full items-center gap-3.5 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: avatarColor(project.name) }}
                    >
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800 group-hover:text-gray-600 transition-colors">
                        {project.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {project.myRole === 'PROJECT_MANAGER' ? 'Manager' : 'Member'}
                      </p>
                    </div>
                    {project.dueSoonCount > 0 && (
                      <span className="text-xs font-medium text-amber-500 shrink-0 tabular-nums">
                        {project.dueSoonCount} due
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Row 2: Recent activity + Team */}
      <div className="grid gap-5 lg:grid-cols-5">

        <Section className="lg:col-span-3" title="Recent Activity">
          {dashboard.recentActivity.length === 0 ? (
            <EmptyState icon={<MessageSquare size={28} />} label="No recent activity" />
          ) : (
            <ul className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
              {dashboard.recentActivity.map((item) => (
                <ActivityRow key={item.id} item={item} slug={slug} router={router} />
              ))}
            </ul>
          )}
        </Section>

        <Section
          className="lg:col-span-2"
          title="Team"
          count={dashboard.members.length}
          action={
            <button
              onClick={() => router.push(`/org/${slug}/members`)}
              className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              Manage <ArrowRight size={12} />
            </button>
          }
        >
          {dashboard.members.length === 0 ? (
            <EmptyState icon={<FolderOpen size={28} />} label="No members yet" />
          ) : (
            <ul className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
              {dashboard.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3.5 px-5 py-3">
                  <Avatar name={member.name} url={member.avatarUrl} size={8} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{member.name}</p>
                    <p className="truncate text-xs text-gray-400">{member.email}</p>
                  </div>
                  <span className="shrink-0 text-[0.7rem] font-medium text-gray-400">
                    {member.role === 'OWNER' ? 'Owner' : member.role === 'ORG_ADMIN' ? 'Admin' : 'Member'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

// ─── Activity row ─────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, { node: React.ReactNode; bg: string }> = {
  task_created: { node: <Plus size={10} />, bg: 'bg-emerald-100 text-emerald-600' },
  task_moved: { node: <ArrowRightLeft size={10} />, bg: 'bg-blue-100 text-blue-600' },
  task_deleted: { node: <AlertTriangle size={10} />, bg: 'bg-red-100 text-red-600' },
  comment_added: { node: <MessageSquare size={10} />, bg: 'bg-gray-100 text-gray-500' },
  member_added: { node: <UserPlus size={10} />, bg: 'bg-purple-100 text-purple-600' },
};

function buildActivityText(item: DashboardData['recentActivity'][number]): React.ReactNode {
  const { metadata } = item;
  const task = metadata.taskTitle ? (
    <span className="font-medium text-gray-800">{metadata.taskTitle}</span>
  ) : null;

  switch (item.type) {
    case 'task_created': return <>created {task}</>;
    case 'task_moved':
      return (
        <>
          moved {task}
          {metadata.fromColumn && metadata.toColumn && (
            <span className="text-gray-400"> · {metadata.fromColumn} → {metadata.toColumn}</span>
          )}
        </>
      );
    case 'comment_added':
      return (
        <>
          commented on {task}
          {metadata.content && (
            <span className="text-gray-400 italic"> "{metadata.content}"</span>
          )}
        </>
      );
    case 'task_deleted':
      return (
        <>deleted <span className="line-through text-gray-400">{metadata.taskTitle}</span></>
      );
    case 'member_added': return <>joined the project</>;
    default: return null;
  }
}

function ActivityRow({
  item, slug, router,
}: {
  item: DashboardData['recentActivity'][number];
  slug: string;
  router: ReturnType<typeof useRouter>;
}) {
  const icon = ACTIVITY_ICON[item.type] ?? ACTIVITY_ICON.task_created;
  const taskId = item.type !== 'task_deleted' ? item.metadata.taskId : undefined;

  return (
    <li
      className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => taskId && router.push(`/org/${slug}/projects/${item.projectId}?taskId=${taskId}`)}
    >
      <Avatar name={item.actor.name} url={item.actor.avatarUrl} size={7} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-600 leading-snug">
          <span className="font-semibold text-gray-900">{item.actor.name}</span>
          {' '}
          {buildActivityText(item)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[0.65rem] font-medium', icon.bg)}>
            {icon.node}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/org/${slug}/projects/${item.projectId}`); }}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            {item.projectName}
          </button>
          <span className="text-gray-200 text-xs">·</span>
          <span className="text-xs text-gray-400">{formatRelativeTime(item.createdAt)}</span>
        </div>
      </div>
    </li>
  );
}
