'use client';

import { use, useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgProjects } from '@/hooks/useProject';
import { getProjectTasks } from '@/services/project.service';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import type { Task, Project } from '@/types/project.types';

// ── Pastel color palette per project ────────────────────────────
const PROJECT_COLORS = [
  { bg: 'bg-[#FFE4D6]', text: 'text-[#C4532A]', dot: '#C4532A' },
  { bg: 'bg-[#E8E0FF]', text: 'text-[#5B4FB5]', dot: '#5B4FB5' },
  { bg: 'bg-[#D4F5E4]', text: 'text-[#1D7A4E]', dot: '#1D7A4E' },
  { bg: 'bg-[#D9EEFF]', text: 'text-[#2D72B8]', dot: '#2D72B8' },
  { bg: 'bg-[#FFF3D6]', text: 'text-[#A67C00]', dot: '#A67C00' },
  { bg: 'bg-[#FFD6E8]', text: 'text-[#B52D6B]', dot: '#B52D6B' },
];
function getProjectColor(index: number) {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfWeekMonday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const start = new Date(first);
  start.setDate(first.getDate() - dow);
  return start;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatPopoverDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric',
  });
}

interface CalendarTask {
  task: Task;
  project: Project;
  colorIndex: number;
}

interface OverflowPopover {
  dateKey: string;
  tasks: CalendarTask[];
  top: number;
  left: number;
}

interface Props {
  params: Promise<{ slug: string }>;
}

const MAX_VISIBLE = 3;

export default function CalendarPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const today = new Date();
  const { user: currentUser } = useAuthStore();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [overflow, setOverflow] = useState<OverflowPopover | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { data: org } = useOrganizationBySlug(slug);
  const { data: projects = [], isLoading: projectsLoading } = useOrgProjects(org?.id ?? '');

  const taskQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ['projects', project.id, 'tasks'],
      queryFn: () => getProjectTasks(project.id),
      enabled: !!project.id,
    })),
  });

  // Close overflow popover when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOverflow(null);
      }
    }
    if (overflow) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflow]);

  // Only tasks assigned to the current user, keyed by due date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    taskQueries.forEach((query, idx) => {
      const project = projects[idx];
      if (!project || !query.data) return;
      for (const task of query.data) {
        if (!task.dueDate) continue;
        const isAssigned = task.assignees?.some((a) => a.id === currentUser?.id);
        if (!isAssigned) continue;
        const dateKey = task.dueDate.slice(0, 10);
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push({ task, project, colorIndex: idx });
      }
    });
    return map;
  }, [taskQueries, projects, currentUser?.id]);

  // 6-week grid starting from the Monday of the first week
  const calendarDays = useMemo(() => {
    const start = startOfWeekMonday(currentYear, currentMonth);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentYear, currentMonth]);

  function goToPrev() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  }
  function goToNext() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  }
  function goToToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  }

  function handleTaskClick(task: Task, projectId: string) {
    router.push(`/org/${slug}/projects/${projectId}?taskId=${task.id}`);
  }

  function handleOverflowClick(
    e: React.MouseEvent<HTMLButtonElement>,
    dateKey: string,
    tasks: CalendarTask[],
  ) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // Shift left if popover would overflow viewport
    const popoverWidth = 260;
    const left = rect.left + popoverWidth > window.innerWidth
      ? window.innerWidth - popoverWidth - 8
      : rect.left;
    setOverflow({ dateKey, tasks, top: rect.bottom + 6, left });
  }

  const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth();
  const loading = projectsLoading || taskQueries.some((q) => q.isLoading);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border-subtle bg-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-base font-semibold text-text-primary min-w-[148px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <button
            onClick={goToNext}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={goToToday}
          disabled={isCurrentMonth}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md border font-medium transition-colors',
            isCurrentMonth
              ? 'border-border-subtle text-text-muted cursor-default'
              : 'border-border-subtle text-text-secondary hover:bg-surface-muted',
          )}
        >
          Today
        </button>
      </div>

      {/* ── Day name row ── */}
      <div className="grid grid-cols-7 border-b border-border-subtle shrink-0">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2.5 px-3 text-xs font-medium text-text-muted uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="flex-1 grid grid-cols-7 overflow-y-auto">
        {calendarDays.map((day, idx) => {
          const isToday = isSameDay(day, today);
          const isOtherMonth = day.getMonth() !== currentMonth;
          const dateKey = toDateKey(day);
          const dayTasks = tasksByDate.get(dateKey) ?? [];
          const visible = dayTasks.slice(0, MAX_VISIBLE);
          const extra = dayTasks.length - MAX_VISIBLE;
          const isLastCol = (idx + 1) % 7 === 0;

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[110px] border-b border-border-subtle p-2 flex flex-col gap-1',
                isLastCol ? '' : 'border-r border-border-subtle',
                isOtherMonth ? 'bg-surface' : 'bg-white',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-0.5',
                  isToday
                    ? 'bg-primary text-white font-bold'
                    : isOtherMonth
                      ? 'text-text-muted'
                      : 'text-text-secondary',
                )}
              >
                {day.getDate()}
              </span>

              {loading && isToday && (
                <div className="h-5 rounded bg-surface-muted animate-pulse" />
              )}

              {visible.map(({ task, project, colorIndex }) => {
                const color = getProjectColor(colorIndex);
                return (
                  <button
                    key={task.id}
                    onClick={() => handleTaskClick(task, project.id)}
                    title={`${task.title} · ${project.name}`}
                    className={cn(
                      'w-full text-left rounded px-2 py-0.5 text-xs font-medium truncate transition-opacity hover:opacity-80',
                      color.bg,
                      color.text,
                    )}
                  >
                    {task.title}
                  </button>
                );
              })}

              {extra > 0 && (
                <button
                  onClick={(e) => handleOverflowClick(e, dateKey, dayTasks)}
                  className="text-left text-xs text-text-muted hover:text-text-primary pl-1 transition-colors"
                >
                  +{extra} more
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Project legend ── */}
      {projects.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-border-subtle shrink-0 bg-surface">
          {projects.map((project, idx) => {
            const color = getProjectColor(idx);
            return (
              <div key={project.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: color.dot }}
                />
                <span className="truncate max-w-[140px]">{project.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Overflow popover (fixed) ── */}
      {overflow && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-64 rounded-xl border border-border-subtle bg-white shadow-lg"
          style={{ top: overflow.top, left: overflow.left }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle">
            <span className="text-sm font-semibold text-text-primary">
              {formatPopoverDate(overflow.dateKey)}
            </span>
            <button
              onClick={() => setOverflow(null)}
              className="rounded p-0.5 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1 p-2 max-h-52 overflow-y-auto">
            {overflow.tasks.map(({ task, project, colorIndex }) => {
              const color = getProjectColor(colorIndex);
              return (
                <button
                  key={task.id}
                  onClick={() => { setOverflow(null); handleTaskClick(task, project.id); }}
                  title={project.name}
                  className={cn(
                    'w-full text-left rounded px-2 py-1 text-xs font-medium truncate transition-opacity hover:opacity-80',
                    color.bg,
                    color.text,
                  )}
                >
                  {task.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
