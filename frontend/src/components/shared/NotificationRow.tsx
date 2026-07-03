'use client';

import { cn } from '@/lib/utils';
import type { Notification } from '@/types/notification.types';

interface NotificationRowProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationRow({ notification, onClick }: NotificationRowProps) {
  return (
    <button
      onClick={() => onClick(notification)}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted',
        !notification.isRead && 'bg-surface'
      )}
    >
      <div className="flex items-center gap-2">
        {!notification.isRead && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />}
        <span className={cn('truncate', !notification.isRead ? 'font-medium text-text-primary' : 'text-text-secondary')}>
          {notification.title}
        </span>
      </div>
      <span className="pl-3.5 text-xs text-text-muted">{timeAgo(notification.createdAt)}</span>
    </button>
  );
}
