'use client';

import { useAdminStats, useAdminGrowth } from '@/hooks/useAdmin';
import GrowthChart from './_components/GrowthChart';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: growth, isLoading: growthLoading } = useAdminGrowth(30);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Platform Overview</h1>

      {statsLoading || !stats ? (
        <p className="text-sm text-text-muted">Loading stats…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Total organizations" value={stats.totalOrganizations} />
          <StatTile label="Suspended organizations" value={stats.suspendedOrgs} />
          <StatTile label="Total users" value={stats.totalUsers} />
          <StatTile label="Blocked users" value={stats.blockedUsers} />
          <StatTile label="Total projects" value={stats.totalProjects} />
          <StatTile label="Total tasks" value={stats.totalTasks} />
        </div>
      )}

      <div className="rounded-xl border border-border-subtle bg-white p-5">
        <h2 className="text-sm font-semibold text-text-primary">New users & organizations — last 30 days</h2>
        {growthLoading || !growth ? (
          <p className="mt-4 text-sm text-text-muted">Loading…</p>
        ) : (
          <div className="mt-4">
            <GrowthChart users={growth.users} organizations={growth.organizations} />
          </div>
        )}
      </div>
    </div>
  );
}
