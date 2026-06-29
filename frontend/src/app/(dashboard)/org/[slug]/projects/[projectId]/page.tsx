'use client';

import { use, useState, useMemo, useEffect, useRef } from 'react';
import { parseApiError } from '@/lib/axios';
import { KanbanSkeleton } from '@/components/shared/skeletons/KanbanSkeleton';
import {
  useProject,
  useProjectColumns,
  useProjectTasks,
  useCreateTask,
  useUpdateTask,
  useMoveTask,
  useDeleteTask,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  useReorderColumns,
} from '@/hooks/useProject';
import { toast } from 'sonner';
import {
  Calendar,
  ChevronDown,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
  Layout,
  List,
  Paperclip,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Task, KanbanColumn } from '@/types/project.types';

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  MeasuringStrategy,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PageProps {
  params: Promise<{ slug: string; projectId: string }>;
}

type ActiveDrag =
  | { type: 'task'; task: Task }
  | { type: 'column'; column: KanbanColumn }
  | null;

const PRIORITY: Record<Task['priority'], { label: string; bar: string; chip: string }> = {
  LOW:      { label: 'Low',      bar: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-700' },
  MEDIUM:   { label: 'Medium',   bar: 'bg-amber-400',   chip: 'bg-amber-50 text-amber-700'   },
  HIGH:     { label: 'High',     bar: 'bg-orange-400',  chip: 'bg-orange-50 text-orange-700'  },
  CRITICAL: { label: 'Critical', bar: 'bg-red-500',     chip: 'bg-red-50 text-red-700'        },
};

// ─────────────────────────────────────────────────────────────
// KanbanCard — drag listeners live ON the card root itself
// ─────────────────────────────────────────────────────────────
function KanbanCard({
  task,
  onEdit,
  overlay = false,
}: {
  task: Task;
  onEdit?: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled: overlay,
  });

  const p = PRIORITY[task.priority];
  const overdue = task.dueDate && !overlay && new Date(task.dueDate) < new Date();

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={overlay ? undefined : onEdit}
      style={
        overlay
          ? undefined
          : { transform: CSS.Translate.toString(transform), transition }
      }
      className={cn(
        'group relative flex flex-col gap-2.5 rounded-lg border bg-white',
        'px-3.5 pb-3 pt-3 select-none touch-none outline-none',
        overlay
          ? 'shadow-2xl border-gray-300 cursor-grabbing scale-[1.03]'
          : 'cursor-grab border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-shadow duration-100 active:cursor-grabbing',
        isDragging && !overlay && 'opacity-0',
      )}
    >
      {/* Priority bar */}
      <span className={cn('absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full', p.bar)} />

      {/* Title */}
      <p className="pl-3 pr-1 text-[13px] font-medium leading-snug text-gray-900">
        {task.title}
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between pl-3">
        {task.assignee ? (
          <div className="flex items-center gap-1.5" title={task.assignee.name}>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white uppercase">
              {task.assignee.name.charAt(0)}
            </div>
            <span className="text-[11px] text-gray-500">{task.assignee.name.split(' ')[0]}</span>
          </div>
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400">
            <User size={10} />
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {task.dueDate && (
            <span className={cn('flex items-center gap-1 text-[11px]', overdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
              <Calendar size={10} />
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', p.chip)}>
            {p.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ColumnTaskArea — useDroppable makes empty columns droppable
// ─────────────────────────────────────────────────────────────
function ColumnTaskArea({
  columnId,
  tasks,
  onEditTask,
}: {
  columnId: string;
  tasks: Task[];
  onEditTask: (t: Task) => void;
}) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  // Makes empty area of column droppable
  const { setNodeRef, isOver } = useDroppable({
    id: `col-drop-${columnId}`,
    data: { type: 'column', columnId },
  });

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 px-2 pb-1 min-h-[56px] rounded-lg transition-colors duration-150',
          isOver && tasks.length === 0 && 'bg-blue-50/60 outline-dashed outline-2 outline-blue-200',
        )}
      >
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onEdit={() => onEditTask(task)} />
        ))}
      </div>
    </SortableContext>
  );
}

// ─────────────────────────────────────────────────────────────
// Column inner (column header + task area + add button)
// ─────────────────────────────────────────────────────────────
function KanbanColumnInner({
  column,
  tasks,
  projectId,
  onAddTask,
  onEditTask,
  onDelete,
  onLocalRename,
  colDragHandleProps,
  isDraggingColumn,
}: {
  column: KanbanColumn;
  tasks: Task[];
  projectId: string;
  onAddTask: (id: string) => void;
  onEditTask: (t: Task) => void;
  onDelete: (id: string) => void;
  onLocalRename: (id: string, name: string) => void;
  colDragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDraggingColumn?: boolean;
}) {
  const updateColumn = useUpdateColumn(projectId, column.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(column.name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setNameVal(column.name); }, [column.name]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [menuOpen]);

  const commitRename = () => {
    const v = nameVal.trim();
    if (v && v !== column.name) {
      onLocalRename(column.id, v);
      updateColumn.mutate({ name: v }, {
        onError: () => { toast.error('Failed to rename'); onLocalRename(column.id, column.name); },
      });
    } else {
      setNameVal(column.name);
    }
    setRenaming(false);
  };

  return (
    <div className={cn(
      'flex w-full flex-col rounded-xl bg-[#f1f2f4]',
      isDraggingColumn && 'opacity-40',
    )}>
      {/* Header */}
      <div className="flex items-center gap-1 px-2.5 pt-2.5 pb-2">
        {/* Column drag grip */}
        <div
          {...colDragHandleProps}
          className="shrink-0 cursor-grab p-1 text-gray-400 hover:text-gray-600 transition-colors touch-none"
        >
          <GripVertical size={14} />
        </div>

        {renaming ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setNameVal(column.name); setRenaming(false); }
            }}
            className="flex-1 min-w-0 rounded-md border border-blue-400 bg-white px-2 py-0.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        ) : (
          <h3 className="flex-1 min-w-0 truncate text-[13px] font-bold text-gray-700 select-none">
            {column.name}
          </h3>
        )}

        <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-500 select-none">
          {tasks.length}
        </span>

        <button
          onClick={() => onAddTask(column.id)}
          className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          title="Add card"
        >
          <Plus size={14} />
        </button>

        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl">
              <button
                onClick={() => { setRenaming(true); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil size={13} className="text-gray-400" /> Rename
              </button>
              <div className="mx-2 my-1 border-t border-gray-100" />
              <button
                onClick={() => { onDelete(column.id); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} /> Delete column
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <ColumnTaskArea columnId={column.id} tasks={tasks} onEditTask={onEditTask} />

      {/* Add card */}
      <button
        onClick={() => onAddTask(column.id)}
        className="mx-2 mb-2 flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
      >
        <Plus size={14} /> Add a card
      </button>
    </div>
  );
}

function SortableColumn(props: {
  column: KanbanColumn;
  tasks: Task[];
  projectId: string;
  onAddTask: (id: string) => void;
  onEditTask: (t: Task) => void;
  onDelete: (id: string) => void;
  onLocalRename: (id: string, name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.column.id,
    data: { type: 'column', column: props.column },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="w-[280px] shrink-0"
    >
      <KanbanColumnInner
        {...props}
        colDragHandleProps={{ ...attributes, ...listeners }}
        isDraggingColumn={isDragging}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Add Task Modal
// ─────────────────────────────────────────────────────────────
function AddTaskModal({
  projectId,
  columns,
  defaultColumnId,
  onClose,
}: {
  projectId: string;
  columns: KanbanColumn[];
  defaultColumnId: string;
  onClose: () => void;
}) {
  const createTask = useCreateTask(projectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM');
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate(
      { title: title.trim(), columnId, description: description.trim() || null, priority, dueDate: dueDate || null },
      {
        onSuccess: () => { toast.success('Card created'); onClose(); },
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded p-1 text-gray-400 hover:bg-gray-100 transition-colors">
          <X size={16} />
        </button>
        <h2 className="text-base font-semibold text-gray-900">Add Card</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">Title *</label>
            <Input autoFocus placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={createTask.isPending} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Column</label>
              <select value={columnId} onChange={(e) => setColumnId(e.target.value)} disabled={createTask.isPending}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                {columns.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])} disabled={createTask.isPending}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                {(Object.keys(PRIORITY) as Task['priority'][]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={createTask.isPending} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Add details..." disabled={createTask.isPending}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={createTask.isPending}>Cancel</Button>
            <Button type="submit" disabled={createTask.isPending || !title.trim()}>
              {createTask.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Adding...</> : 'Add Card'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Task Edit Drawer
// ─────────────────────────────────────────────────────────────
function TaskDrawer({ task, projectId, onClose }: { task: Task; projectId: string; onClose: () => void }) {
  const updateTask = useUpdateTask(projectId, task.id);
  const deleteTask = useDeleteTask(projectId);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<Task['priority']>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!title.trim()) return;
    setSaving(true);
    updateTask.mutate(
      { title: title.trim(), description: description.trim() || null, priority, dueDate: dueDate || null },
      {
        onSuccess: () => { toast.success('Card updated'); onClose(); },
        onError: () => toast.error('Failed to update card'),
        onSettled: () => setSaving(false),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm('Delete this card?')) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => { toast.success('Card deleted'); onClose(); },
      onError: () => toast.error('Failed to delete card'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="flex w-full max-w-[480px] flex-col border-l border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Edit Card</h2>
          <button onClick={onClose} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 px-6 py-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Add more detail..."
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">Priority</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRIORITY) as Task['priority'][]).map((p) => (
                <button key={p} onClick={() => setPriority(p)}
                  className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold transition-all',
                    priority === p ? PRIORITY[p].chip + ' ring-2 ring-offset-1 ring-current border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  )}>
                  {PRIORITY[p].label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1"><Calendar size={12} /> Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-auto" />
          </div>
          {task.assignee && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Assignee</label>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white uppercase">{task.assignee.name.charAt(0)}</div>
                <span className="text-sm text-gray-800">{task.assignee.name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 -ml-3 px-3" onClick={handleDelete} disabled={deleteTask.isPending}>Delete</Button>
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function ProjectKanbanPage({ params }: PageProps) {
  const { projectId } = use(params);

  const { data: project, isLoading: projLoading } = useProject(projectId);
  const { data: serverColumns, isLoading: colsLoading } = useProjectColumns(projectId);
  const { data: serverTasks, isLoading: tasksLoading } = useProjectTasks(projectId);

  const moveTask    = useMoveTask(projectId);
  const createColumn  = useCreateColumn(projectId);
  const deleteColumn  = useDeleteColumn(projectId);
  const reorderColumns = useReorderColumns(projectId);

  // ── local drag state ───────────────────────────────────────
  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>([]);
  const [localTaskMap, setLocalTaskMap] = useState<Record<string, Task[]>>({});
  const [activeDrag, setActiveDrag]    = useState<ActiveDrag>(null);

  // Tracks in-flight mutations so server sync doesn't snap back
  const [pendingMutations, setPendingMutations] = useState(0);
  const isMutating = pendingMutations > 0;

  // ── other UI state ─────────────────────────────────────────
  const [addingTaskColumnId, setAddingTaskColumnId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn]  = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [activeTab, setActiveTab] = useState('Board');
  const [mounted, setMounted]    = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── sync server → local (blocked during drag AND mutation) ─
  useEffect(() => {
    if (serverColumns && !activeDrag && !isMutating) setLocalColumns(serverColumns);
  }, [serverColumns, activeDrag, isMutating]);

  useEffect(() => {
    if (serverColumns && serverTasks && !activeDrag && !isMutating) {
      const map: Record<string, Task[]> = {};
      serverColumns.forEach((col) => { map[col.id] = []; });
      serverTasks.forEach((task) => {
        if (map[task.columnId]) map[task.columnId].push(task);
      });
      Object.values(map).forEach((arr) => arr.sort((a, b) => a.position - b.position));
      setLocalTaskMap(map);
    }
  }, [serverColumns, serverTasks, activeDrag, isMutating]);

  // ── sensors ────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const columnIds = useMemo(() => localColumns.map((c) => c.id), [localColumns]);

  // ── drag helpers ───────────────────────────────────────────
  /** Given an item ID, find which column it lives in right now */
  function findColumn(id: string): string | undefined {
    for (const [colId, tasks] of Object.entries(localTaskMap)) {
      if (tasks.some((t) => t.id === id)) return colId;
    }
  }

  // ── drag handlers ──────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    const d = active.data.current;
    if (d?.type === 'task')   setActiveDrag({ type: 'task',   task: d.task });
    if (d?.type === 'column') setActiveDrag({ type: 'column', column: d.column });
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.id === over.id) return;
    if (active.data.current?.type !== 'task') return;

    const overId    = over.id as string;
    const overType  = over.data.current?.type as string | undefined;

    // Resolve source column
    const srcColId = findColumn(active.id as string);
    if (!srcColId) return;

    // Resolve target column
    let tgtColId: string | undefined;
    if (overType === 'task') {
      tgtColId = findColumn(overId);
    } else if (overId.startsWith('col-drop-')) {
      tgtColId = overId.replace('col-drop-', '');
    } else if (overType === 'column') {
      tgtColId = over.data.current?.column?.id ?? over.data.current?.columnId ?? overId;
    }

    if (!tgtColId) return;

    setLocalTaskMap((prev) => {
      const srcTasks = prev[srcColId] ?? [];
      const tgtTasks = prev[tgtColId!] ?? [];

      if (srcColId === tgtColId) {
        // Same column — reorder
        if (overType !== 'task') return prev;
        const from = srcTasks.findIndex((t) => t.id === active.id);
        const to   = srcTasks.findIndex((t) => t.id === overId);
        if (from === -1 || to === -1 || from === to) return prev;
        return { ...prev, [srcColId]: arrayMove(srcTasks, from, to) };
      }

      // Different column — move card
      const movingTask = srcTasks.find((t) => t.id === active.id);
      if (!movingTask) return prev;

      const newSrc = srcTasks.filter((t) => t.id !== active.id);
      const newTgt = [...tgtTasks];
      const moved  = { ...movingTask, columnId: tgtColId! };

      if (overType === 'task') {
        const toIdx = newTgt.findIndex((t) => t.id === overId);
        newTgt.splice(toIdx >= 0 ? toIdx : newTgt.length, 0, moved);
      } else {
        newTgt.push(moved);
      }

      return { ...prev, [srcColId]: newSrc, [tgtColId!]: newTgt };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDrag(null);

    const activeType = active.data.current?.type;

    if (activeType === 'column') {
      if (!over || active.id === over.id) return;
      const from = localColumns.findIndex((c) => c.id === active.id);
      const to   = localColumns.findIndex((c) => c.id === over.id);
      if (from === -1 || to === -1 || from === to) return;
      const ordered = arrayMove(localColumns, from, to);
      setLocalColumns(ordered);
      setPendingMutations((n) => n + 1);
      reorderColumns.mutate(ordered.map((c) => c.id), {
        onError: () => { toast.error('Failed to reorder columns'); if (serverColumns) setLocalColumns(serverColumns); },
        onSettled: () => setPendingMutations((n) => n - 1),
      });
      return;
    }

    if (activeType === 'task') {
      // Find where the card ended up in local state
      const colId = findColumn(active.id as string);
      if (!colId) return;
      const position = (localTaskMap[colId] ?? []).findIndex((t) => t.id === active.id);
      setPendingMutations((n) => n + 1);
      moveTask.mutate(
        { taskId: active.id as string, columnId: colId, position: Math.max(0, position) },
        {
          onError: () => toast.error('Failed to move card'),
          onSettled: () => setPendingMutations((n) => n - 1),
        }
      );
    }
  }

  // ── column actions ─────────────────────────────────────────
  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    createColumn.mutate(
      { name: newColumnName.trim() },
      {
        onSuccess: () => { toast.success('Column added'); setAddingColumn(false); setNewColumnName(''); },
        onError: () => toast.error('Failed to add column'),
      }
    );
  };

  const handleDeleteColumn = (colId: string) => {
    if (!confirm('Delete this column and all its cards?')) return;
    deleteColumn.mutate(colId, {
      onSuccess: () => toast.success('Column deleted'),
      onError:  () => toast.error('Failed to delete column'),
    });
  };

  const handleLocalRename = (colId: string, name: string) =>
    setLocalColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)));

  // ── render ─────────────────────────────────────────────────
  const isLoading = projLoading || colsLoading || tasksLoading;

  if (!mounted || isLoading) return <KanbanSkeleton />;

  if (!project) {
    return (
      <div className="m-8 rounded-lg border border-red-100 bg-red-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-600">Project not found</h2>
      </div>
    );
  }

  const tabs = [
    { name: 'Board', icon: Layout },
    { name: 'List',  icon: List },
    { name: 'Files', icon: Paperclip },
    { name: 'Settings', icon: Settings },
  ];

  const allTasks = Object.values(localTaskMap).flat();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">{project.name}</h1>
          <ChevronDown size={18} className="text-gray-400 cursor-pointer" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {['1','2','3'].map((n) => (
              <img key={n} className="inline-block h-7 w-7 rounded-full ring-2 ring-white" src={`https://i.pravatar.cc/100?img=${n}`} alt="" />
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-sm border-gray-200">
            <User size={13} /> Invite
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 px-8">
        <div className="flex gap-5">
          {tabs.map(({ name, icon: Icon }) => {
            const active = activeTab === name;
            return (
              <button key={name} onClick={() => setActiveTab(name)}
                className={cn('flex items-center gap-1.5 pb-3 text-[13px] font-medium transition-colors border-b-2',
                  active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}>
                <Icon size={14} />{name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Board */}
      {activeTab === 'Board' ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              <div className="flex h-full items-start gap-3">
                {localColumns.map((col) => (
                  <SortableColumn
                    key={col.id}
                    column={col}
                    tasks={localTaskMap[col.id] || []}
                    projectId={projectId}
                    onAddTask={setAddingTaskColumnId}
                    onEditTask={setEditingTask}
                    onDelete={handleDeleteColumn}
                    onLocalRename={handleLocalRename}
                  />
                ))}

                {/* Add column */}
                <div className="w-[280px] shrink-0">
                  {addingColumn ? (
                    <form onSubmit={handleAddColumn} className="rounded-xl bg-[#f1f2f4] p-3 space-y-2">
                      <Input autoFocus placeholder="Column name" value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)} className="text-sm bg-white" />
                      <div className="flex gap-1.5">
                        <Button type="submit" size="sm" disabled={createColumn.isPending || !newColumnName.trim()}>Add</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => { setAddingColumn(false); setNewColumnName(''); }}>Cancel</Button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setAddingColumn(true)}
                      className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-3 py-3 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
                      <Plus size={15} /> Add column
                    </button>
                  )}
                </div>
              </div>
            </SortableContext>

            {/* Drag overlay — floats above everything, smooth */}
            <DragOverlay 
              dropAnimation={{ 
                duration: 200, 
                easing: 'cubic-bezier(0.18,0.67,0.6,1.22)',
                sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
              }}
            >
              {activeDrag?.type === 'task' && (
                <KanbanCard task={activeDrag.task} overlay />
              )}
              {activeDrag?.type === 'column' && (
                <div className="w-[280px] shadow-2xl rounded-xl opacity-95">
                  <KanbanColumnInner
                    column={activeDrag.column}
                    tasks={localTaskMap[activeDrag.column.id] || []}
                    projectId={projectId}
                    onAddTask={() => {}} onEditTask={() => {}} onDelete={() => {}} onLocalRename={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      ) : activeTab === 'List' ? (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="col-span-5">Title</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-2">Priority</div>
              <div className="col-span-2 text-right">Due Date</div>
            </div>
            <div className="divide-y divide-gray-100">
              {allTasks.map((task) => (
                <div key={task.id} onClick={() => setEditingTask(task)}
                  className="grid grid-cols-12 gap-4 px-5 py-3.5 text-sm items-center hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="col-span-5 font-medium text-gray-900 truncate">{task.title}</div>
                  <div className="col-span-3">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                      {localColumns.find((c) => c.id === task.columnId)?.name || '—'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', PRIORITY[task.priority].chip)}>
                      {PRIORITY[task.priority].label}
                    </span>
                  </div>
                  <div className="col-span-2 text-right text-gray-400 text-xs">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                  </div>
                </div>
              ))}
              {allTasks.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-400">No cards yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          This view is coming soon.
        </div>
      )}

      {/* Modals */}
      {addingTaskColumnId && serverColumns && (
        <AddTaskModal projectId={projectId} columns={serverColumns} defaultColumnId={addingTaskColumnId} onClose={() => setAddingTaskColumnId(null)} />
      )}
      {editingTask && (
        <TaskDrawer task={editingTask} projectId={projectId} onClose={() => setEditingTask(null)} />
      )}
    </div>
  );
}
