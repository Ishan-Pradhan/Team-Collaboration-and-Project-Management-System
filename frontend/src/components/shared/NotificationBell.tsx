'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { NotificationRow } from '@/components/shared/NotificationRow';
import { useUnreadCount, useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotification';
import { useMyOrganizations } from '@/hooks/useOrganization';
import type { Notification } from '@/types/notification.types';

export function resolveNotificationLink(
  notification: Notification,
  orgs: { id: string; slug: string }[] | undefined
): string | null {
  const org = orgs?.find((o) => o.id === notification.organizationId);
  if (!org) return null;

  switch (notification.entityType) {
    case 'channel':
      return `/org/${org.slug}/chat?channelId=${notification.entityId}`;
    case 'project':
      return `/org/${org.slug}/projects/${notification.entityId}`;
    case 'task':
      return notification.projectId
        ? `/org/${org.slug}/projects/${notification.projectId}?taskId=${notification.entityId}`
        : null;
    default:
      return null;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { data: unreadCount } = useUnreadCount();
  const { data: recent } = useNotifications(1);
  const { data: orgs } = useMyOrganizations();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleRowClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = resolveNotificationLink(notification, orgs);
    if (link) router.push(link);
  };

  const items = recent?.notifications.slice(0, 10) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded p-1.5 text-primary hover:bg-surface-muted transition-colors">
          <Bell size={18} />
          {!!unreadCount && (
            <Badge variant="danger" className="absolute -right-0.5 -top-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold text-text-primary">Notifications</span>
          {!!unreadCount && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs font-medium text-brand hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-text-muted">No notifications yet</p>
          ) : (
            items.map((n) => <NotificationRow key={n.id} notification={n} onClick={handleRowClick} />)
          )}
        </div>
        <div className="border-t border-border-subtle p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => router.push('/notifications')}
          >
            View all
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
