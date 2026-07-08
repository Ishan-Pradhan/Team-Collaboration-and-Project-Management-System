'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgDashboard } from '@/hooks/useProject';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { PRIORITY, isDoneColumn } from '@/constants/task.constants';
import {
  AlertTriangle, ArrowRight, CheckSquare,
  Clock, FolderOpen, MessageSquare, Users,
} from 'lucide-react';
import { ErrorState } from '@/components/shared/ErrorState';
import { ActivityRow } from '@/components/shared/ActivityRow';
import { OrgOverviewSkeleton } from '@/components/shared/skeletons/OrgOverviewSkeleton';
import { getSocket } from '@/lib/socket';
import { avatarColor } from '@/lib/avatarColor';

// ─── Helpers ─────────────────────────────────────────────────

function getDueDateLabel(dueDate: string | null, columnName?: string | null): { label: string; cls: string } | null {
  if (isDoneColumn(columnName)) return { label: 'Completed', cls: 'text-success' };
  if (!dueDate) return null;
  const due = new Date(dueDate + 'T12:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'text-danger' };
  if (diff === 0) return { label: 'Due today', cls: 'text-warning' };
  if (diff <= 2) return { label: `${diff}d left`, cls: 'text-warning' };
  return { label: `${diff}d left`, cls: 'text-text-muted' };
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
    <div className={cn('flex flex-col rounded-lg bg-surface border border-border-subtle overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">{count}</span>
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
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-muted">
      {icon}
      <p className="text-sm text-text-muted">{label}</p>
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────

function StatTile({
  icon: Icon,
  color,
  value,
  label,
  glow,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  value: number;
  label: string;
  glow?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-6 py-5',
        onClick && 'text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
      )}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color, boxShadow: glow ? `0 0 0 4px color-mix(in srgb, ${color} 20%, transparent)` : undefined }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight text-text-primary">{value}</p>
        <p className="truncate text-xs font-medium text-text-secondary">{label}</p>
      </div>
    </Wrapper>
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
  const qc = useQueryClient();

  useEffect(() => {
    if (!org || !dashboard) return;
    const myProjectIds = new Set(dashboard.myProjects.map((p) => p.id));
    const socket = getSocket();

    const onActivityNew = ({ projectId }: { projectId: string }) => {
      if (myProjectIds.has(projectId)) {
        qc.invalidateQueries({ queryKey: ['organizations', org.id, 'dashboard'] });
      }
    };

    socket.on('activity:new', onActivityNew);
    return () => {
      socket.off('activity:new', onActivityNew);
    };
  }, [org, dashboard, qc]);

  if (isLoading || !org) return <OrgOverviewSkeleton />;
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
          <p className="text-sm text-text-muted">{greeting},</p>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">{firstName}</h1>
        </div>
        <div className="hidden items-center gap-2.5 sm:flex">
          <div className="text-right">
            <p className="text-sm text-text-muted">{today}</p>
            <p className="text-sm font-medium text-text-secondary">{org.name}</p>
          </div>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: avatarColor(org.name) }}
          >
            {org.name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-border-subtle bg-surface overflow-hidden divide-x divide-y sm:divide-y-0 divide-border-subtle">
        <StatTile
          icon={FolderOpen}
          color="var(--color-workspace-northpeak)"
          value={dashboard.stats.projectCount}
          label="Projects"
          onClick={() => router.push(`/org/${slug}/projects`)}
        />
        <StatTile
          icon={CheckSquare}
          color="var(--color-workspace-velocity)"
          value={dashboard.stats.assignedTaskCount}
          label="Assigned"
        />
        <StatTile
          icon={AlertTriangle}
          color="var(--color-danger)"
          value={dashboard.stats.overdueCount}
          label="Overdue"
          glow={dashboard.stats.overdueCount > 0}
        />
        <StatTile
          icon={Clock}
          color="var(--color-warning)"
          value={dashboard.stats.dueSoonCount}
          label="Due Soon"
        />
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
            <ul className="divide-y divide-border-subtle max-h-[320px] overflow-y-auto">
              {dashboard.assignedTasks.map((task) => {
                const due = getDueDateLabel(task.dueDate, task.columnName);
                return (
                  <li key={task.id}>
                    <button
                      onClick={() => router.push(`/org/${slug}/projects/${task.projectId}?taskId=${task.id}`)}
                      className="flex w-full items-center gap-3.5 px-5 py-3 text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <span className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY[task.priority].bar)} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {task.title}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {task.projectName}
                          <span className="mx-1.5 text-border-muted">·</span>
                          {task.columnName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('rounded px-1.5 py-0.5 text-[0.7rem] font-semibold', PRIORITY[task.priority].chip)}>
                          {PRIORITY[task.priority].label}
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
              className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              All <ArrowRight size={12} />
            </button>
          }
        >
          {dashboard.myProjects.length === 0 ? (
            <EmptyState icon={<FolderOpen size={28} />} label="You're not in any projects" />
          ) : (
            <ul className="divide-y divide-border-subtle max-h-[320px] overflow-y-auto">
              {dashboard.myProjects.slice(0, 8).map((project) => (
                <li key={project.id}>
                  <button
                    onClick={() => router.push(`/org/${slug}/projects/${project.id}`)}
                    className="flex w-full items-center gap-3.5 px-5 py-3 text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: avatarColor(project.name) }}
                    >
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {project.name}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {project.myRole === 'PROJECT_MANAGER' ? 'Manager' : 'Member'}
                      </p>
                    </div>
                    {project.dueSoonCount > 0 && (
                      <span className="text-xs font-medium text-warning shrink-0 tabular-nums">
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
            <ul className="divide-y divide-border-subtle max-h-[320px] overflow-y-auto">
              {dashboard.recentActivity.map((item) => (
                <ActivityRow key={item.id} item={item} slug={slug} />
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
              className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Manage <ArrowRight size={12} />
            </button>
          }
        >
          {dashboard.members.length === 0 ? (
            <EmptyState icon={<Users size={28} />} label="No members yet" />
          ) : (
            <ul className="divide-y divide-border-subtle max-h-[320px] overflow-y-auto">
              {dashboard.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3.5 px-5 py-3 hover:bg-surface-hover transition-colors">
                  <Avatar name={member.name} url={member.avatarUrl} size={8} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{member.name}</p>
                    <p className="truncate text-xs text-text-muted">{member.email}</p>
                  </div>
                  <span className="shrink-0 text-[0.7rem] font-medium text-text-muted">
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

