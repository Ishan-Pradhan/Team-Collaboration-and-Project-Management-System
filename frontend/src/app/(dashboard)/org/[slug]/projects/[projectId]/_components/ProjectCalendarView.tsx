'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, KanbanColumn } from '@/types/project.types';

// ── Column-based color palette (pastel) ─────────────────────────
const COLUMN_COLORS = [
  { bg: 'bg-[#FFE4D6]', text: 'text-[#C4532A]' },
  { bg: 'bg-[#E8E0FF]', text: 'text-[#5B4FB5]' },
  { bg: 'bg-[#D4F5E4]', text: 'text-[#1D7A4E]' },
  { bg: 'bg-[#D9EEFF]', text: 'text-[#2D72B8]' },
  { bg: 'bg-[#FFF3D6]', text: 'text-[#A67C00]' },
  { bg: 'bg-[#FFD6E8]', text: 'text-[#B52D6B]' },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfWeekMonday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7;
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

interface TaskWithColor {
  task: Task;
  colorIdx: number;
}

interface OverflowPopover {
  dateKey: string;
  tasks: TaskWithColor[];
  top: number;
  left: number;
}

interface Props {
  tasks: Task[];
  columns: KanbanColumn[];
  onOpenTask: (task: Task) => void;
}

const MAX_VISIBLE = 3;

export default function ProjectCalendarView({ tasks, columns, onOpenTask }: Props) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [overflow, setOverflow] = useState<OverflowPopover | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Map column id → stable color index
  const columnColorMap = useMemo(() => {
    const map = new Map<string, number>();
    columns.forEach((col, idx) => map.set(col.id, idx));
    return map;
  }, [columns]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOverflow(null);
      }
    }
    if (overflow) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflow]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithColor[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const dateKey = task.dueDate.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push({
        task,
        colorIdx: columnColorMap.get(task.columnId) ?? 0,
      });
    }
    return map;
  }, [tasks, columnColorMap]);

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

  function handleOverflowClick(
    e: React.MouseEvent<HTMLButtonElement>,
    dateKey: string,
    dayTasks: TaskWithColor[],
  ) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 260;
    const left = rect.left + popoverWidth > window.innerWidth
      ? window.innerWidth - popoverWidth - 8
      : rect.left;
    setOverflow({ dateKey, tasks: dayTasks, top: rect.bottom + 6, left });
  }

  const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth();

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
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

        {/* ── Day names ── */}
        <div className="grid grid-cols-7 border-b border-border-subtle shrink-0">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-2.5 px-3 text-xs font-medium text-text-muted uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* ── Grid ── */}
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

                {visible.map(({ task, colorIdx }) => {
                  const color = COLUMN_COLORS[colorIdx % COLUMN_COLORS.length];
                  const colName = columns.find((c) => c.id === task.columnId)?.name;
                  return (
                    <button
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      title={colName ? `${task.title} · ${colName}` : task.title}
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

        {/* ── Column legend ── */}
        {columns.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-border-subtle shrink-0 bg-surface">
            {columns.map((col, idx) => {
              const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
              return (
                <div key={col.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className={cn('inline-block h-2.5 w-2.5 rounded-sm shrink-0', color.bg)}
                    style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                  />
                  <span className="truncate max-w-[120px]">{col.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
            {overflow.tasks.map(({ task, colorIdx }) => {
              const color = COLUMN_COLORS[colorIdx % COLUMN_COLORS.length];
              return (
                <button
                  key={task.id}
                  onClick={() => {
                    setOverflow(null);
                    onOpenTask(task);
                  }}
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
