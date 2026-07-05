'use client';

import { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgProjects } from '@/hooks/useProject';
import { getProjectTasks } from '@/services/project.service';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import type { Task, Project } from '@/types/project.types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const PROJECT_COLORS = [
  { bg: '#FFE4D6', text: '#C4532A', dot: '#C4532A' },
  { bg: '#E8E0FF', text: '#5B4FB5', dot: '#5B4FB5' },
  { bg: '#D4F5E4', text: '#1D7A4E', dot: '#1D7A4E' },
  { bg: '#D9EEFF', text: '#2D72B8', dot: '#2D72B8' },
  { bg: '#FFF3D6', text: '#A67C00', dot: '#A67C00' },
  { bg: '#FFD6E8', text: '#B52D6B', dot: '#B52D6B' },
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
  resource: { task: Task; project: Project; colorIndex: number };
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default function CalendarPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const today = new Date();
  const { user: currentUser } = useAuthStore();

  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const { data: org } = useOrganizationBySlug(slug);
  const { data: projects = [], isLoading: projectsLoading } = useOrgProjects(org?.id ?? '');

  const taskQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ['projects', project.id, 'tasks'],
      queryFn: () => getProjectTasks(project.id),
      enabled: !!project.id,
    })),
  });

  const events = useMemo<RBCEvent[]>(() => {
    const result: RBCEvent[] = [];
    taskQueries.forEach((query, idx) => {
      const project = projects[idx];
      if (!project || !query.data) return;
      for (const task of query.data) {
        if (!task.dueDate) continue;
        if (!task.assignees?.some((a) => a.id === currentUser?.id)) continue;
        const d = new Date(task.dueDate.slice(0, 10) + 'T12:00:00');
        result.push({
          id: task.id,
          title: task.title,
          start: d,
          end: d,
          allDay: true,
          resource: { task, project, colorIndex: idx },
        });
      }
    });
    return result;
  }, [taskQueries, projects, currentUser?.id]);

  const eventPropGetter = (event: RBCEvent) => {
    const color = PROJECT_COLORS[event.resource.colorIndex % PROJECT_COLORS.length];
    return { style: { backgroundColor: color.bg, color: color.text, border: 'none' } };
  };

  const isCurrentMonth =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();

  const loading = projectsLoading || taskQueries.some((q) => q.isLoading);

  return (
    <div className="flex h-[90vh] flex-col rounded-xl border border-border-subtle bg-white overflow-hidden">

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
        {loading ? (
          <div className="flex h-full items-center justify-center text-text-muted text-sm">
            Loading…
          </div>
        ) : (
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
            onSelectEvent={(event) =>
              router.push(`/org/${slug}/projects/${event.resource.project.id}?taskId=${event.resource.task.id}`)
            }
            popup
            style={{ height: '100%' }}
          />
        )}
      </div>

      {/* Project legend */}
      {projects.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-border-subtle shrink-0 bg-surface">
          {projects.map((project, idx) => {
            const color = PROJECT_COLORS[idx % PROJECT_COLORS.length];
            return (
              <div key={project.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color.dot }} />
                <span className="truncate max-w-[140px]">{project.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
