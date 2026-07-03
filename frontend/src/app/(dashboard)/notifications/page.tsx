'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { NotificationRow } from '@/components/shared/NotificationRow';
import { resolveNotificationLink } from '@/lib/notificationLinks';
import { NotificationsSkeleton } from '@/components/shared/skeletons/NotificationsSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotification';
import { useMyOrganizations } from '@/hooks/useOrganization';
import { cn } from '@/lib/utils';
import type { Notification, NotificationEntityType } from '@/types/notification.types';

interface NotificationGroup {
  label: 'Today' | 'Earlier';
  items: Notification[];
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function groupByDate(notifications: Notification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const n of notifications) {
    const label: NotificationGroup['label'] = isToday(n.createdAt) ? 'Today' : 'Earlier';
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(n);
    } else {
      groups.push({ label, items: [n] });
    }
  }
  return groups;
}

type CategoryFilter = NotificationEntityType | 'all';

const CATEGORIES: { label: string; value: CategoryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Tasks', value: 'task' },
  { label: 'Chat', value: 'channel' },
  { label: 'Projects', value: 'project' },
  { label: 'Team', value: 'organization' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const entityType = category === 'all' ? undefined : category;
  const { data, isLoading, error, refetch } = useNotifications(page, entityType);
  const { data: orgs } = useMyOrganizations();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  if (isLoading) return <NotificationsSkeleton />;
  if (error || !data) {
    return <ErrorState title="Failed to load notifications" onRetry={() => refetch()} />;
  }

  const handleRowClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = resolveNotificationLink(notification, orgs);
    if (link) router.push(link);
  };

  const handleSelectCategory = (value: CategoryFilter) => {
    setCategory(value);
    setPage(1);
  };

  const { notifications, meta } = data;
  const groups = groupByDate(notifications);

  return (
    <div className="flex h-full gap-4">
      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto rounded-xl border border-border-subtle bg-white">
        <div className="border-b border-border-subtle px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Filter</span>
        </div>
        <div className="space-y-0.5 p-2">
          {CATEGORIES.map(({ label, value }) => {
            const active = category === value;
            return (
              <button
                key={value}
                onClick={() => handleSelectCategory(value)}
                className={cn(
                  'flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'bg-primary/10 font-medium text-primary' : 'text-text-secondary hover:bg-surface-muted',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border-subtle bg-white p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text-primary">Notifications</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              className="text-text-secondary hover:bg-transparent hover:text-text-primary"
            >
              Mark all as read
            </Button>
          </div>

          <div className="rounded-lg border border-border-subtle bg-white p-2">
            {notifications.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-text-muted">No notifications yet</p>
            ) : (
              groups.map((group, i) => (
                <div key={i}>
                  <p className="px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {group.label}
                  </p>
                  <div className="divide-y divide-border-subtle">
                    {group.items.map((n) => (
                      <NotificationRow key={n.id} notification={n} onClick={handleRowClick} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-text-muted">
                Page {meta.currentPage} of {meta.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
