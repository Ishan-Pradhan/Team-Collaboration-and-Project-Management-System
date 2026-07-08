'use client';

import type { LucideIcon } from 'lucide-react';
import { Bell, Building2, CalendarClock, Check, CheckSquare, FolderOpen, Hash, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, NotificationEntityType } from '@/types/notification.types';

interface NotificationRowProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
  onMarkRead: (notification: Notification) => void;
  onDelete: (notification: Notification) => void;
}

const ENTITY_ICON: Record<NotificationEntityType, LucideIcon> = {
  channel: Hash,
  project: FolderOpen,
  task: CheckSquare,
  organization: Building2,
  personal_event: CalendarClock,
};

// One fixed color per entity type, drawn from the app's existing workspace
// palette — the avatar fill stands in for a person's photo where we have no
// actor identity to show (notifications don't carry an actor field today).
const ENTITY_COLOR: Record<NotificationEntityType, string> = {
  task: 'var(--color-workspace-velocity)',
  project: 'var(--color-workspace-northpeak)',
  channel: 'var(--color-workspace-studio)',
  organization: 'var(--color-brand)',
  personal_event: 'var(--color-primary)',
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

export function NotificationRow({ notification, onClick, onMarkRead, onDelete }: NotificationRowProps) {
  const Icon = (notification.entityType && ENTITY_ICON[notification.entityType]) || Bell;
  const color = (notification.entityType && ENTITY_COLOR[notification.entityType]) || 'var(--color-text-muted)';
  const unread = !notification.isRead;

  return (
    <div className={cn('group relative flex items-center gap-2 px-2 py-2.5 transition-colors', unread ? 'bg-surface-muted' : 'hover:bg-surface-hover')}>
      {/* unread gutter — a single consistent accent marks "new", independent of type */}
      <span className="flex w-2.5 shrink-0 justify-center">
        {unread && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
      </span>

      <button onClick={() => onClick(notification)} className="flex min-w-0 flex-1 items-start gap-3 py-0.5 text-left">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate text-sm', unread ? 'font-semibold text-text-primary' : 'text-text-secondary')}>
              {notification.title}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-text-muted">{timeAgo(notification.createdAt)}</span>
          </div>
          {notification.body && <p className="mt-0.5 truncate text-xs text-text-muted">{notification.body}</p>}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {unread && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification);
            }}
            title="Mark as read"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Check size={14} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification);
          }}
          title="Delete"
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
