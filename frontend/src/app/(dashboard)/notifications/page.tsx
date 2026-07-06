'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationRow } from '@/components/shared/NotificationRow';
import { resolveNotificationLink } from '@/lib/notificationLinks';
import { NotificationsSkeleton } from '@/components/shared/skeletons/NotificationsSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '@/hooks/useNotification';
import { useMyOrganizations } from '@/hooks/useOrganization';
import type { Notification } from '@/types/notification.types';

type Tab = 'all' | 'unread';

interface NotificationGroup {
  label: 'Today' | 'Yesterday' | 'Earlier';
  items: Notification[];
}

function dayBucket(iso: string): NotificationGroup['label'] {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'Earlier';
}

function groupByDate(notifications: Notification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const n of notifications) {
    const label = dayBucket(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(n);
    } else {
      groups.push({ label, items: [n] });
    }
  }
  return groups;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary/5 text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
      )}
    >
      {children}
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const { data, isLoading, error, refetch } = useNotifications(page);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: orgs } = useMyOrganizations();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  if (isLoading) return <NotificationsSkeleton />;
  if (error || !data) {
    return <ErrorState title="Failed to load notifications" onRetry={() => refetch()} />;
  }

  const handleRowClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = resolveNotificationLink(notification, orgs);
    if (link) router.push(link);
  };

  const { notifications, meta } = data;
  const hasUnread = unreadCount > 0;
  const visible = tab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;
  const groups = groupByDate(visible);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Notifications</h1>

      <div className="flex items-center justify-between border-b border-border-subtle">
        <div className="flex gap-1">
          <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
            All
          </TabButton>
          <TabButton active={tab === 'unread'} onClick={() => setTab('unread')}>
            Unread
            {hasUnread && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {unreadCount}
              </span>
            )}
          </TabButton>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasUnread}
          onClick={() => markAllRead.mutate()}
          className="mb-1 text-text-secondary hover:bg-transparent hover:text-text-primary disabled:opacity-40"
        >
          Mark all as read
        </Button>
      </div>

      <div className="rounded-xl border border-border-subtle bg-white p-2">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
              {tab === 'unread' ? (
                <Check className="text-text-secondary" size={18} />
              ) : (
                <Inbox className="text-text-muted" size={18} />
              )}
            </div>
            <p className="text-sm font-medium text-text-primary">
              {tab === 'unread' ? "You're all caught up" : 'Nothing here yet'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {tab === 'unread' ? 'New activity will show up here.' : "You'll see updates about your tasks and projects here."}
            </p>
          </div>
        ) : (
          groups.map((group, i) => (
            <div key={i}>
              <p className="px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted first:pt-1">
                {group.label}
              </p>
              <div className="divide-y divide-border-subtle">
                {group.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onClick={handleRowClick}
                    onMarkRead={(notification) => markRead.mutate(notification.id)}
                    onDelete={(notification) => deleteNotification.mutate(notification.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {tab === 'all' && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="gap-1">
            <ChevronLeft size={14} />
            Previous
          </Button>
          <span className="text-xs text-text-muted">
            Page {meta.currentPage} of {meta.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1">
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
