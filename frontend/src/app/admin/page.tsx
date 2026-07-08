'use client';

import { Ban, Building2, CheckSquare, FolderOpen, ShieldAlert, Users } from 'lucide-react';
import { useAdminStats, useAdminGrowth } from '@/hooks/useAdmin';
import { AdminOverviewSkeleton } from '@/components/shared/skeletons/AdminOverviewSkeleton';
import GrowthChart from './_components/GrowthChart';

function StatTile({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-tight text-text-primary">{value.toLocaleString()}</p>
        <p className="truncate text-xs font-medium text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: growth, isLoading: growthLoading } = useAdminGrowth(30);

  if (statsLoading || growthLoading || !stats || !growth) return <AdminOverviewSkeleton />;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Platform Overview</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatTile icon={Building2} color="var(--color-workspace-northpeak)" label="Organizations" value={stats.totalOrganizations} />
        <StatTile icon={ShieldAlert} color="var(--color-danger)" label="Suspended orgs" value={stats.suspendedOrgs} />
        <StatTile icon={Users} color="var(--color-workspace-velocity)" label="Total users" value={stats.totalUsers} />
        <StatTile icon={Ban} color="var(--color-danger)" label="Blocked users" value={stats.blockedUsers} />
        <StatTile icon={FolderOpen} color="var(--color-brand)" label="Total projects" value={stats.totalProjects} />
        <StatTile icon={CheckSquare} color="var(--color-success)" label="Total tasks" value={stats.totalTasks} />
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">New users &amp; organizations</h2>
        <p className="text-xs text-text-muted">Last 30 days</p>
        <div className="mt-4">
          <GrowthChart users={growth.users} organizations={growth.organizations} />
        </div>
      </div>
    </div>
  );
}
