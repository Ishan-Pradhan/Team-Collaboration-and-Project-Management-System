'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckSquare, Clock, FolderOpen, ListChecks } from 'lucide-react';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgAnalytics } from '@/hooks/useProject';
import { ErrorState } from '@/components/shared/ErrorState';
import { AnalyticsSkeleton } from '@/components/shared/skeletons/AnalyticsSkeleton';
import { avatarColor } from '@/lib/avatarColor';
import { cn } from '@/lib/utils';
import CompletionTrendChart from './CompletionTrendChart';
import HorizontalBarChart from './HorizontalBarChart';
import MemberWorkloadChart from './MemberWorkloadChart';

interface Props {
  params: Promise<{ slug: string }>;
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-white">
      <div className="flex items-baseline justify-between border-b border-border-subtle px-5 py-3.5">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  color,
  value,
  label,
  valueClassName,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  value: number;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-5">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className={cn('text-2xl font-bold leading-tight text-text-primary', valueClassName)}>{value}</p>
        <p className="truncate text-xs font-medium text-text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function AnalyticsPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: org } = useOrganizationBySlug(slug);
  const { data: analytics, isLoading, error, refetch } = useOrgAnalytics(org?.id ?? '');

  if (isLoading || !org) return <AnalyticsSkeleton />;
  if (error || !analytics) {
    return (
      <ErrorState
        title="Failed to load analytics"
        message="Something went wrong loading organization analytics."
        onRetry={() => refetch()}
      />
    );
  }

  const openTaskCount = analytics.projectHealth.reduce((sum, p) => sum + p.taskCount, 0);
  const overdueCount = analytics.projectHealth.reduce((sum, p) => sum + p.overdueCount, 0);
  const completedIn30Days = analytics.completionTrend.completed.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-text-muted">Org-wide activity across all projects</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-border-subtle bg-white overflow-hidden divide-x divide-y sm:divide-y-0 divide-border-subtle">
        <StatTile icon={FolderOpen} color="var(--color-workspace-northpeak)" value={analytics.projectHealth.length} label="Projects" />
        <StatTile icon={ListChecks} color="var(--color-workspace-velocity)" value={openTaskCount} label="Open tasks" />
        <StatTile
          icon={AlertTriangle}
          color="var(--color-danger)"
          value={overdueCount}
          label="Overdue"
          valueClassName={overdueCount > 0 ? 'text-danger' : undefined}
        />
        <StatTile icon={CheckSquare} color="var(--color-success)" value={completedIn30Days} label="Completed (30d)" />
      </div>

      <Card title="Task completion" subtitle="Last 30 days">
        <CompletionTrendChart
          created={analytics.completionTrend.created}
          completed={analytics.completionTrend.completed}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Task status breakdown">
          <HorizontalBarChart
            data={analytics.statusBreakdown.map((s) => ({ label: s.name, count: s.count }))}
            emptyLabel="No tasks yet"
          />
        </Card>

        <Card title="Member workload" subtitle="Open tasks assigned">
          <MemberWorkloadChart data={analytics.memberWorkload} emptyLabel="No open tasks assigned" />
        </Card>
      </div>

      <div className="rounded-lg border border-border-subtle bg-white">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <h2 className="text-sm font-semibold text-text-primary">Project health</h2>
        </div>
        {analytics.projectHealth.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">No projects yet</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.projectHealth.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/org/${slug}/projects/${project.id}`)}
                className="group flex flex-col overflow-hidden rounded-lg border border-border-subtle text-left transition-shadow hover:shadow-dropdown focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="h-1.5 shrink-0" style={{ backgroundColor: avatarColor(project.name) }} />
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <p className="truncate text-sm font-semibold text-text-primary group-hover:underline">{project.name}</p>
                  <p className="text-xs text-text-muted">
                    {project.taskCount} tasks
                    {project.lastActivityAt && (
                      <> · last activity {new Date(project.lastActivityAt).toLocaleDateString()}</>
                    )}
                  </p>
                  <div className="mt-auto pt-1">
                    {project.overdueCount > 0 ? (
                      <span className="badge-danger inline-flex items-center gap-1">
                        <AlertTriangle size={11} /> {project.overdueCount} overdue
                      </span>
                    ) : project.dueSoonCount > 0 ? (
                      <span className="badge-warning inline-flex items-center gap-1">
                        <Clock size={11} /> {project.dueSoonCount} due soon
                      </span>
                    ) : (
                      <span className="badge-success">On track</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
