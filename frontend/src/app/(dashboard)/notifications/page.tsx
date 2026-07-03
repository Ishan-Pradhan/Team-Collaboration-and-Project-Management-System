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
import type { Notification } from '@/types/notification.types';

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useNotifications(page);
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

  const { notifications, meta } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Notifications</h1>
        <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
          Mark all as read
        </Button>
      </div>

      <div className="rounded-xl border border-border-subtle bg-white p-2">
        {notifications.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-text-muted">No notifications yet</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onClick={handleRowClick} />
            ))}
          </div>
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
  );
}
