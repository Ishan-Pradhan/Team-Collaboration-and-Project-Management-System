import type { Task } from '@/types/project.types';

export const PRIORITY: Record<Task['priority'], { label: string; bar: string; chip: string }> = {
  LOW:      { label: 'Low',      bar: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-700' },
  MEDIUM:   { label: 'Medium',   bar: 'bg-amber-400',   chip: 'bg-amber-50 text-amber-700'     },
  HIGH:     { label: 'High',     bar: 'bg-orange-400',  chip: 'bg-orange-50 text-orange-700'   },
  CRITICAL: { label: 'Critical', bar: 'bg-red-500',     chip: 'bg-red-50 text-red-700'         },
};

export type DueStatus = 'completed' | 'overdue' | 'due-today' | 'due-soon' | 'on-track' | null;

export const DUE_STATUS: Record<NonNullable<DueStatus>, { label: string; chip: string }> = {
  'completed': { label: 'Completed',  chip: 'bg-success-soft text-success' },
  'overdue':   { label: 'Overdue',    chip: 'bg-danger-soft text-danger' },
  'due-today': { label: 'Due Today',  chip: 'bg-warning-soft text-warning' },
  'due-soon':  { label: 'Due Soon',   chip: 'bg-warning-soft text-warning' },
  'on-track':  { label: 'On Track',   chip: 'bg-success-soft text-success' },
};

const DONE_COLUMN_RE = /\b(done|complet\w*|finish\w*|clos\w*|shipped?|deployed?|released?|delivered?)\b/i;

export function isDoneColumn(columnName: string | undefined | null): boolean {
  return !!columnName && DONE_COLUMN_RE.test(columnName);
}

export function getDueStatus(dueDate: string | null | undefined, columnName?: string | null): DueStatus {
  if (isDoneColumn(columnName)) return 'completed';
  if (!dueDate) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueStr = new Date(dueDate).toISOString().slice(0, 10);
  if (dueStr < todayStr) return 'overdue';
  if (dueStr === todayStr) return 'due-today';
  const diffDays = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) return 'due-soon';
  return 'on-track';
}
