'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import {
  useProject,
  useProjectColumns,
  useProjectTasks,
  useCreateTask,
  useUpdateTask,
  useMoveTask,
  useDeleteTask,
  useCreateColumn,
} from '@/hooks/useProject';
import { toast } from 'sonner';
import {
  Calendar,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Plus,
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
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
} from '@dnd-kit/core';

interface PageProps {
  params: Promise<{ slug: string; projectId: string }>;
}

const PRIORITY_CONFIG: Record<
  Task['priority'],
  { label: string; className: string }
> = {
  LOW: {
    label: 'Low',
    className: 'bg-[#e6f4ea] text-[#1e8e3e]',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-[#fef7e0] text-[#f29900]',
  },
  HIGH: {
    label: 'High',
    className: 'bg-[#fce8e6] text-[#d93025]',
  },
  CRITICAL: {
    label: 'Critical',
    className: 'bg-red-100 text-red-800 font-bold',
  },
};

// ─────────────────────────────────────────────────────────────
// Task Card Component
// ─────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (t: Task) => void;
}) {
  const priority = PRIORITY_CONFIG[task.priority];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: {
      taskId: task.id,
      columnId: task.columnId,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'group relative cursor-grab select-none rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all duration-150',
        'hover:border-gray-300 hover:shadow-md',
        isDragging && 'rotate-[1.5deg] scale-[1.02] shadow-xl opacity-90 cursor-grabbing z-10 border-brand-400'
      )}
      onClick={() => onEdit(task)}
    >
      <div className="mb-3">
        <p className="text-[13px] font-medium text-gray-900 leading-snug">
          {task.title}
        </p>
      </div>

      <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
        <div className="flex items-center gap-2">
          {task.assignee ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white uppercase"
                title={task.assignee.name}
              >
                {task.assignee.name.charAt(0)}
              </div>
              <span className="text-[11px] text-gray-600 font-medium">{task.assignee.name.split(' ')[0]}</span>
            </div>
          ) : (
             <div className="flex items-center gap-1.5">
               <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                 <User size={10} />
               </div>
               <span className="text-[11px] text-gray-600 font-medium">Unassigned</span>
             </div>
          )}
          
          {task.dueDate && (
            <span className="ml-1 text-gray-500 font-medium">
              {new Date(task.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>

        <span
          className={cn(
            'rounded px-2 py-0.5 text-[11px] font-medium',
            priority.className
          )}
        >
          {priority.label}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Kanban Column Component
// ─────────────────────────────────────────────────────────────
function KanbanColumnView({
  column,
  tasks,
  onAddTask,
  onEditTask,
}: {
  column: KanbanColumn;
  tasks: Task[];
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex w-[280px] min-w-[280px] flex-shrink-0 flex-col rounded-xl bg-[#f4f5f7] p-2">
      {/* Column header */}
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-bold text-gray-900">{column.name}</h3>
          <span className="text-[13px] text-gray-500 font-medium">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Drop zone + task list */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2.5 overflow-y-auto px-1 pb-1 min-h-[100px] transition-colors',
          isOver && 'bg-gray-200/50 rounded-lg outline-dashed outline-2 outline-gray-300'
        )}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEditTask}
          />
        ))}

        <button
          onClick={() => onAddTask(column.id)}
          className="mt-1 flex items-center gap-1.5 w-full rounded p-1.5 text-[13px] text-gray-500 hover:bg-gray-200/70 hover:text-gray-700 transition-colors"
        >
          <Plus size={14} />
          Add task
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Task Edit Drawer
// ─────────────────────────────────────────────────────────────
function TaskDrawer({
  task,
  projectId,
  onClose,
}: {
  task: Task | null;
  projectId: string;
  onClose: () => void;
}) {
  const updateTask = useUpdateTask(projectId, task?.id || '');
  const deleteTask = useDeleteTask(projectId);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<Task['priority']>(task?.priority || 'MEDIUM');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [saving, setSaving] = useState(false);

  if (!task) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    updateTask.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        dueDate: dueDate || null,
      },
      {
        onSuccess: () => {
          toast.success('Task updated');
          onClose();
        },
        onError: () => toast.error('Failed to update task'),
        onSettled: () => setSaving(false),
      }
    );
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTask.mutate(task.id, {
        onSuccess: () => {
          toast.success('Task deleted');
          onClose();
        },
        onError: () => toast.error('Failed to delete task')
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="flex w-full max-w-[480px] flex-col border-l border-border-subtle bg-white shadow-xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <h2 className="text-base font-semibold text-text-primary">Edit Task</h2>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-5 px-6 py-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Add more detail..."
              className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Priority</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRIORITY_CONFIG) as Task['priority'][]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold transition-all',
                    priority === p
                      ? PRIORITY_CONFIG[p].className + ' ring-2 ring-offset-1 ring-current border-transparent'
                      : 'border-border-subtle text-text-secondary hover:bg-surface-muted'
                  )}
                >
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary flex items-center gap-1">
              <Calendar size={12} />
              Due Date
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-auto"
            />
          </div>

          {task.assignee && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Assignee</label>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white uppercase">
                  {task.assignee.name.charAt(0)}
                </div>
                <span className="text-sm text-text-primary">{task.assignee.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle px-6 py-4">
          <Button 
            variant="ghost" 
            className="text-danger hover:bg-danger/10 hover:text-danger px-3 -ml-3"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
          >
            Delete
          </Button>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
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
      {
        title: title.trim(),
        columnId,
        description: description.trim() || null,
        priority,
        dueDate: dueDate || null,
      },
      {
        onSuccess: () => {
          toast.success('Task created!');
          onClose();
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'Failed to create task');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-modal">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
        >
          <X size={16} />
        </button>

        <h2 className="text-base font-semibold text-text-primary">Add Task</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Title *</label>
            <Input
              autoFocus
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={createTask.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Column</label>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              disabled={createTask.isPending}
              className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task['priority'])}
                disabled={createTask.isPending}
                className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
              >
                {(Object.keys(PRIORITY_CONFIG) as Task['priority'][]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_CONFIG[p].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={createTask.isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Description <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Add details..."
              disabled={createTask.isPending}
              className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={createTask.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending || !title.trim()}>
              {createTask.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Task'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Kanban Board Page
// ─────────────────────────────────────────────────────────────
export default function ProjectKanbanPage({ params }: PageProps) {
  const { slug, projectId } = use(params);
  const router = useRouter();

  const { data: org } = useOrganizationBySlug(slug);
  const { data: project, isLoading: projLoading } = useProject(projectId);
  const { data: columns, isLoading: colsLoading } = useProjectColumns(projectId);
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(projectId);

  const moveTask = useMoveTask(projectId);
  const createColumn = useCreateColumn(projectId);

  const [addingTaskColumnId, setAddingTaskColumnId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [activeTab, setActiveTab] = useState('Board');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoading = projLoading || colsLoading || tasksLoading;

  // Group tasks by columnId
  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    columns?.forEach((col) => {
      map[col.id] = [];
    });
    tasks?.forEach((task) => {
      if (map[task.columnId]) {
        map[task.columnId].push(task);
      }
    });
    return map;
  }, [tasks, columns]);

  const handleDropTask = (taskId: string, targetColumnId: string) => {
    const position = (tasksByColumn[targetColumnId] || []).length;
    moveTask.mutate(
      { taskId, columnId: targetColumnId, position },
      {
        onSuccess: () => toast.success('Task moved'),
        onError: () => toast.error('Failed to move task'),
      }
    );
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    createColumn.mutate(
      { name: newColumnName.trim() },
      {
        onSuccess: () => {
          toast.success('Column created');
          setAddingColumn(false);
          setNewColumnName('');
        },
        onError: () => toast.error('Failed to create column'),
      }
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumnId = over.id as string;
    const sourceColumnId = active.data.current?.columnId;

    if (sourceColumnId !== targetColumnId) {
      handleDropTask(taskId, targetColumnId);
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-6 text-center m-8">
        <h2 className="text-lg font-semibold text-danger">Project not found</h2>
      </div>
    );
  }

  const tabs = [
    { name: 'Board', icon: Layout },
    { name: 'List', icon: List },
    { name: 'Timeline', icon: Calendar },
    { name: 'Calendar', icon: Calendar },
    { name: 'Files', icon: Paperclip },
    { name: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Page Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {project.name}
          </h1>
          <ChevronDown className="text-gray-500 cursor-pointer" size={20} />
        </div>

        <div className="flex items-center gap-4">
          {/* Mock Avatars */}
          <div className="flex -space-x-2">
            <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white" src="https://i.pravatar.cc/100?img=1" alt=""/>
            <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white" src="https://i.pravatar.cc/100?img=2" alt=""/>
            <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white" src="https://i.pravatar.cc/100?img=3" alt=""/>
          </div>
          
          <Button variant="outline" className="h-8 gap-1.5 text-[13px] font-medium border-gray-300 text-gray-700">
            <User size={14} />
            Invite
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 border-gray-300 text-gray-700">
            <MoreHorizontal size={14} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 px-8">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.name;
            return (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={cn(
                  "flex items-center gap-2 pb-3 text-[14px] font-medium transition-colors border-b-2",
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon size={15} />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'Board' ? (
        <div className="flex-1 overflow-x-auto p-8 pt-6">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 items-start h-full">
              {(columns || []).map((col) => (
                <KanbanColumnView
                  key={col.id}
                  column={col}
                  tasks={tasksByColumn[col.id] || []}
                  onAddTask={(colId) => setAddingTaskColumnId(colId)}
                  onEditTask={setEditingTask}
                />
              ))}

              {/* Add Column Button */}
              <div className="w-[280px] min-w-[280px] flex-shrink-0">
                {addingColumn ? (
                  <form
                    onSubmit={handleAddColumn}
                    className="rounded-xl bg-[#f4f5f7] p-3 space-y-2"
                  >
                    <Input
                      autoFocus
                      placeholder="Column name"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      className="text-sm bg-white"
                    />
                    <div className="flex gap-1.5">
                      <Button type="submit" size="sm" disabled={createColumn.isPending || !newColumnName.trim()}>
                        Add
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { setAddingColumn(false); setNewColumnName(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="flex items-center gap-2 px-2 py-2 text-[14px] text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    <Plus size={16} />
                    Add column
                  </button>
                )}
              </div>
            </div>
          </DndContext>
        </div>
      ) : activeTab === 'List' ? (
        <div className="flex-1 p-8">
           <h2 className="text-lg font-semibold text-gray-800 mb-4">Project Tasks</h2>
           <div className="rounded-lg border border-gray-200 bg-white">
             <div className="grid grid-cols-12 gap-4 border-b border-gray-200 p-4 font-medium text-sm text-gray-500">
               <div className="col-span-5">Title</div>
               <div className="col-span-3">Status</div>
               <div className="col-span-2">Priority</div>
               <div className="col-span-2 text-right">Due Date</div>
             </div>
             <div className="divide-y divide-gray-200">
               {tasks?.map(task => (
                 <div key={task.id} className="grid grid-cols-12 gap-4 p-4 text-sm items-center hover:bg-gray-50 cursor-pointer" onClick={() => setEditingTask(task)}>
                   <div className="col-span-5 font-medium text-gray-900">{task.title}</div>
                   <div className="col-span-3">
                     <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{columns?.find(c => c.id === task.columnId)?.name || 'Unknown'}</span>
                   </div>
                   <div className="col-span-2">
                     <span className={cn('px-2 py-1 rounded text-xs', PRIORITY_CONFIG[task.priority].className)}>
                       {PRIORITY_CONFIG[task.priority].label}
                     </span>
                   </div>
                   <div className="col-span-2 text-right text-gray-500">
                     {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                   </div>
                 </div>
               ))}
               {tasks?.length === 0 && (
                 <div className="p-8 text-center text-gray-500">No tasks found.</div>
               )}
             </div>
           </div>
        </div>
      ) : (
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-gray-400">
          <p>This view is under construction.</p>
        </div>
      )}

      {/* Add Task Modal */}
      {addingTaskColumnId && columns && (
        <AddTaskModal
          projectId={projectId}
          columns={columns}
          defaultColumnId={addingTaskColumnId}
          onClose={() => setAddingTaskColumnId(null)}
        />
      )}

      {/* Task Edit Drawer */}
      {editingTask && (
        <TaskDrawer
          task={editingTask}
          projectId={projectId}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
