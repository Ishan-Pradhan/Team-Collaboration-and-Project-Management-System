'use client';

import { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgProjects } from '@/hooks/useProject';
import { getProjectTasks } from '@/services/project.service';
import { usePersonalEvents, useCreatePersonalEvent, useDeletePersonalEvent } from '@/hooks/usePersonalEvents';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { Task, Project } from '@/types/project.types';
import type { PersonalEvent } from '@/types/personalEvent.types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const PROJECT_COLORS = [
  { bg: '#FFE4D6', text: '#C4532A', dot: '#C4532A' },
  { bg: '#E8E0FF', text: '#5B4FB5', dot: '#5B4FB5' },
  { bg: '#D4F5E4', text: '#1D7A4E', dot: '#1D7A4E' },
  { bg: '#D9EEFF', text: '#2D72B8', dot: '#2D72B8' },
  { bg: '#FFF3D6', text: '#A67C00', dot: '#A67C00' },
  { bg: '#FFD6E8', text: '#B52D6B', dot: '#B52D6B' },
];

const PERSONAL_EVENT_COLOR = { bg: '#F5E8C6', text: '#8A6D1F', dot: '#C59638' };

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

type RBCEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
} & (
  | { resource: { type: 'task'; task: Task; project: Project; colorIndex: number } }
  | { resource: { type: 'personal'; event: PersonalEvent } }
);

interface Props {
  params: Promise<{ slug: string }>;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function AddEventModal({
  onClose,
  onSubmit,
  isPending,
  initialDate = '',
}: {
  onClose: () => void;
  onSubmit: (title: string, dueDate: string) => void;
  isPending: boolean;
  initialDate?: string;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(initialDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-modal">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-text-secondary hover:bg-surface-muted transition-colors"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-text-primary">New Event</h2>
        <p className="mt-0.5 text-xs text-text-secondary">Only you can see this event.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && dueDate) onSubmit(title.trim(), dueDate);
          }}
          className="mt-5 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="event-title">
              Title
            </label>
            <Input
              id="event-title"
              placeholder="e.g. Dentist appointment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="event-date">
              Date
            </label>
            <Input
              id="event-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || !dueDate}>
              {isPending ? <><Loader2 size={14} className="animate-spin mr-1.5" />Creating…</> : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CalendarPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const today = new Date();
  const { user: currentUser } = useAuthStore();

  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [addEventDate, setAddEventDate] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PersonalEvent | null>(null);

  const { data: org } = useOrganizationBySlug(slug);
  const { data: projects = [], isLoading: projectsLoading } = useOrgProjects(org?.id ?? '');
  const { data: personalEvents = [] } = usePersonalEvents(org?.id ?? '');
  const createPersonalEvent = useCreatePersonalEvent(org?.id ?? '');
  const deletePersonalEventMutation = useDeletePersonalEvent(org?.id ?? '');

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
          resource: { type: 'task', task, project, colorIndex: idx },
        });
      }
    });
    for (const event of personalEvents) {
      const d = new Date(event.dueDate.slice(0, 10) + 'T12:00:00');
      result.push({
        id: event.id,
        title: event.title,
        start: d,
        end: d,
        allDay: true,
        resource: { type: 'personal', event },
      });
    }
    return result;
  }, [taskQueries, projects, currentUser?.id, personalEvents]);

  const eventPropGetter = (event: RBCEvent) => {
    if (event.resource.type === 'personal') {
      return { style: { backgroundColor: PERSONAL_EVENT_COLOR.bg, color: PERSONAL_EVENT_COLOR.text, border: 'none' } };
    }
    const color = PROJECT_COLORS[event.resource.colorIndex % PROJECT_COLORS.length];
    return { style: { backgroundColor: color.bg, color: color.text, border: 'none' } };
  };

  const handleCreateEvent = (title: string, dueDate: string) => {
    createPersonalEvent.mutate(
      { title, dueDate },
      {
        onSuccess: () => {
          toast.success('Event created');
          setShowAddEvent(false);
        },
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      }
    );
  };

  const confirmDeleteEvent = () => {
    if (!deleteTarget) return;
    deletePersonalEventMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Event deleted');
        setDeleteTarget(null);
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const isCurrentMonth =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();

  const loading = projectsLoading || taskQueries.some((q) => q.isLoading);

  return (
    <>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setAddEventDate(''); setShowAddEvent(true); }}
              className="flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors"
            >
              <Plus size={14} /> Add Event
            </button>
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
              selectable
              onSelectSlot={(slotInfo) => {
                setAddEventDate(toDateInputValue(slotInfo.start));
                setShowAddEvent(true);
              }}
              onSelectEvent={(event) => {
                if (event.resource.type === 'personal') {
                  setDeleteTarget(event.resource.event);
                } else {
                  router.push(`/org/${slug}/projects/${event.resource.project.id}?taskId=${event.resource.task.id}`);
                }
              }}
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
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: PERSONAL_EVENT_COLOR.dot }} />
              <span>My events</span>
            </div>
          </div>
        )}
      </div>

      {showAddEvent && (
        <AddEventModal
          onClose={() => setShowAddEvent(false)}
          onSubmit={handleCreateEvent}
          isPending={createPersonalEvent.isPending}
          initialDate={addEventDate}
        />
      )}

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteEvent}
        title="Delete Event"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
        isLoading={deletePersonalEventMutation.isPending}
      />
    </>
  );
}
