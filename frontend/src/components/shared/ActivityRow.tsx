'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRightLeft, MessageSquare, Plus, UserMinus, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityEntry } from '@/types/project.types';

const AVATAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ name, url, size = 7 }: { name: string; url?: string | null; size?: number }) {
  const px = size * 4;
  const style = { width: px, height: px, fontSize: px * 0.38, flexShrink: 0 };
  if (url) return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={style} />;
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold uppercase shrink-0"
      style={{ ...style, backgroundColor: avatarColor(name) }}>
      {name.charAt(0)}
    </div>
  );
}

const ACTIVITY_ICON: Record<string, { node: React.ReactNode; bg: string }> = {
  task_created: { node: <Plus size={10} />, bg: 'bg-emerald-100 text-emerald-600' },
  task_moved: { node: <ArrowRightLeft size={10} />, bg: 'bg-blue-100 text-blue-600' },
  task_deleted: { node: <AlertTriangle size={10} />, bg: 'bg-red-100 text-red-600' },
  comment_added: { node: <MessageSquare size={10} />, bg: 'bg-surface-muted text-text-secondary' },
  member_added: { node: <UserPlus size={10} />, bg: 'bg-purple-100 text-purple-600' },
  member_removed: { node: <UserMinus size={10} />, bg: 'bg-orange-100 text-orange-600' },
};

function buildActivityText(item: ActivityEntry): React.ReactNode {
  const { metadata } = item;
  const task = metadata.taskTitle ? (
    <span className="font-medium text-text-primary">{metadata.taskTitle}</span>
  ) : null;

  switch (item.type) {
    case 'task_created': return <>created {task}</>;
    case 'task_moved':
      return (
        <>
          moved {task}
          {metadata.fromColumn && metadata.toColumn && (
            <span className="text-text-muted"> · {metadata.fromColumn} → {metadata.toColumn}</span>
          )}
        </>
      );
    case 'comment_added':
      return (
        <>
          commented on {task}
          {metadata.content && (
            <span className="text-text-muted italic"> "{metadata.content}"</span>
          )}
        </>
      );
    case 'task_deleted':
      return (
        <>deleted <span className="line-through text-text-muted">{metadata.taskTitle}</span></>
      );
    case 'member_added':
      return <>added <span className="font-medium text-text-primary">{metadata.targetName ?? 'a member'}</span> to the project</>;
    case 'member_removed':
      return <>removed <span className="font-medium text-text-primary">{metadata.targetName ?? 'a member'}</span> from the project</>;
    default: return null;
  }
}

interface ActivityRowProps {
  item: ActivityEntry;
  slug: string;
  showProjectLink?: boolean;
}

export function ActivityRow({ item, slug, showProjectLink = true }: ActivityRowProps) {
  const router = useRouter();
  const icon = ACTIVITY_ICON[item.type] ?? ACTIVITY_ICON.task_created;
  const taskId = item.type !== 'task_deleted' ? item.metadata.taskId : undefined;

  return (
    <li
      className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-surface-hover transition-colors cursor-pointer"
      onClick={() => taskId && router.push(`/org/${slug}/projects/${item.projectId}?taskId=${taskId}`)}
    >
      <Avatar name={item.actor.name} url={item.actor.avatarUrl} size={7} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-secondary leading-snug">
          <span className="font-semibold text-text-primary">{item.actor.name}</span>
          {' '}
          {buildActivityText(item)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[0.65rem] font-medium', icon.bg)}>
            {icon.node}
          </span>
          {showProjectLink && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/org/${slug}/projects/${item.projectId}`); }}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {item.projectName}
              </button>
              <span className="text-text-muted text-xs">·</span>
            </>
          )}
          <span className="text-xs text-text-muted">{formatRelativeTime(item.createdAt)}</span>
        </div>
      </div>
    </li>
  );
}
