'use client';

import { use } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgAnalytics } from '@/hooks/useProject';
import { ErrorState } from '@/components/shared/ErrorState';
import CompletionTrendChart from './CompletionTrendChart';
import HorizontalBarChart from './HorizontalBarChart';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function AnalyticsPage({ params }: Props) {
  const { slug } = use(params);
  const { data: org } = useOrganizationBySlug(slug);
  const { data: analytics, isLoading, error, refetch } = useOrgAnalytics(org?.id ?? '');

  if (isLoading || !org) return <p className="text-sm text-text-muted">Loading analytics…</p>;
  if (error || !analytics) {
    return (
      <ErrorState
        title="Failed to load analytics"
        message="Something went wrong loading organization analytics."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-text-muted">Org-wide activity across all projects</p>
      </div>

      <div className="rounded-lg border border-border-subtle bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Task completion — last 30 days</h2>
        <CompletionTrendChart
          created={analytics.completionTrend.created}
          completed={analytics.completionTrend.completed}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Task status breakdown</h2>
          <HorizontalBarChart
            data={analytics.statusBreakdown.map((s) => ({ label: s.name, count: s.count }))}
            emptyLabel="No tasks yet"
          />
        </div>

        <div className="rounded-lg border border-border-subtle bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Member workload</h2>
          <HorizontalBarChart
            data={analytics.memberWorkload.map((m) => ({ label: m.name, count: m.count }))}
            emptyLabel="No open tasks assigned"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-white">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <h2 className="text-sm font-semibold text-text-primary">Project health</h2>
        </div>
        {analytics.projectHealth.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">No projects yet</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {analytics.projectHealth.map((project) => (
              <li key={project.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{project.name}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {project.taskCount} tasks
                    {project.lastActivityAt && (
                      <> · last activity {new Date(project.lastActivityAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {project.overdueCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium text-danger">
                      <AlertTriangle size={12} /> {project.overdueCount} overdue
                    </span>
                  )}
                  {project.dueSoonCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium text-warning">
                      <Clock size={12} /> {project.dueSoonCount} due soon
                    </span>
                  )}
                  {project.overdueCount === 0 && project.dueSoonCount === 0 && (
                    <span className="text-xs text-text-muted">On track</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
