import type { Task } from '@/types/project.types';

export const PRIORITY: Record<Task['priority'], { label: string; bar: string; chip: string }> = {
  LOW:      { label: 'Low',      bar: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-700' },
  MEDIUM:   { label: 'Medium',   bar: 'bg-amber-400',   chip: 'bg-amber-50 text-amber-700'     },
  HIGH:     { label: 'High',     bar: 'bg-orange-400',  chip: 'bg-orange-50 text-orange-700'   },
  CRITICAL: { label: 'Critical', bar: 'bg-red-500',     chip: 'bg-red-50 text-red-700'         },
};
