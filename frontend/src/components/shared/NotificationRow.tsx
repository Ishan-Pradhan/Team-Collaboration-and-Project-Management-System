'use client';

import type { LucideIcon } from 'lucide-react';
import { Bell, Building2, CheckSquare, FolderOpen, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types/notification.types';

interface NotificationRowProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

const ENTITY_ICON: Record<string, LucideIcon> = {
  channel: Hash,
  project: FolderOpen,
  task: CheckSquare,
  organization: Building2,
};

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
  const Icon = (notification.entityType && ENTITY_ICON[notification.entityType]) || Bell;

  return (
    <button
      onClick={() => onClick(notification)}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted',
        !notification.isRead && 'bg-surface'
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
        <Icon size={15} className={notification.isRead ? 'text-text-muted' : 'text-primary'} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn('truncate', !notification.isRead ? 'font-medium text-text-primary' : 'text-text-secondary')}>
            {notification.title}
          </span>
          <span className="shrink-0 text-xs text-text-muted">{timeAgo(notification.createdAt)}</span>
        </div>
        {notification.body && (
          <p className="truncate text-xs text-text-muted">{notification.body}</p>
        )}
      </div>
    </button>
  );
}
