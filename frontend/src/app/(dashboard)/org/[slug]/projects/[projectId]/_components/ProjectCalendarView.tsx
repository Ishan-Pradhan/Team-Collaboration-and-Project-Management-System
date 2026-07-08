'use client';

import { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, KanbanColumn } from '@/types/project.types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const COLUMN_COLORS = [
  { bg: '#FFE4D6', text: '#C4532A' },
  { bg: '#E8E0FF', text: '#5B4FB5' },
  { bg: '#D4F5E4', text: '#1D7A4E' },
  { bg: '#D9EEFF', text: '#2D72B8' },
  { bg: '#FFF3D6', text: '#A67C00' },
  { bg: '#FFD6E8', text: '#B52D6B' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-GB': enGB },
});

interface RBCEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: { task: Task; colorIdx: number };
}

interface Props {
  tasks: Task[];
  columns: KanbanColumn[];
  onOpenTask: (task: Task) => void;
}

export default function ProjectCalendarView({ tasks, columns, onOpenTask }: Props) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const columnColorMap = useMemo(() => {
    const map = new Map<string, number>();
    columns.forEach((col, idx) => map.set(col.id, idx));
    return map;
  }, [columns]);

  const events = useMemo<RBCEvent[]>(() =>
    tasks
      .filter((t) => t.dueDate)
      .map((t) => {
        const d = new Date(t.dueDate!.slice(0, 10) + 'T12:00:00');
        return {
          id: t.id,
          title: t.title,
          start: d,
          end: d,
          allDay: true,
          resource: { task: t, colorIdx: columnColorMap.get(t.columnId) ?? 0 },
        };
      }),
    [tasks, columnColorMap],
  );

  const eventPropGetter = (event: RBCEvent) => {
    const color = COLUMN_COLORS[event.resource.colorIdx % COLUMN_COLORS.length];
    return { style: { backgroundColor: color.bg, color: color.text, border: 'none' } };
  };

  const isCurrentMonth =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();

  return (
    <div className="h-[80vh] flex flex-col overflow-hidden p-6">
      <div className="flex h-full flex-col rounded-xl border border-border-subtle bg-surface overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle text-text-secondary hover:bg-surface-muted transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-base font-semibold text-text-primary min-w-[148px] text-center">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button
              onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle text-text-secondary hover:bg-surface-muted transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))}
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

        {/* Calendar */}
        <div className="flex-1 overflow-hidden">
          <Calendar<RBCEvent>
            localizer={localizer}
            culture="en-GB"
            events={events}
            defaultView="month"
            views={['month']}
            date={currentDate}
            onNavigate={(date) => setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1))}
            toolbar={false}
            eventPropGetter={eventPropGetter}
            onSelectEvent={(event) => onOpenTask(event.resource.task)}
            popup
            style={{ height: '100%' }}
          />
        </div>

        {/* Column legend */}
        {columns.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-border-subtle shrink-0 bg-surface">
            {columns.map((col, idx) => {
              const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
              return (
                <div key={col.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: color.bg, border: '1px solid rgba(0,0,0,0.08)' }}
                  />
                  <span className="truncate max-w-[120px]">{col.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
