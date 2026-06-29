'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Layout, List, Paperclip, Plus, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Task, KanbanColumn } from '@/types/project.types';
import { PRIORITY } from '@/constants/task.constants';
import { KanbanSkeleton } from '@/components/shared/skeletons/KanbanSkeleton';
import {
  useProject,
  useProjectColumns,
  useProjectTasks,
  useCreateColumn,
  useDeleteColumn,
  useReorderColumns,
  useMoveTask,
} from '@/hooks/useProject';

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
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

import { SortableColumn, KanbanCard } from './KanbanColumn';
import { AddTaskModal } from './AddTaskModal';
import { TaskDrawer } from './TaskDrawer';

type ActiveDrag =
  | { type: 'task'; task: Task }
  | { type: 'column'; column: KanbanColumn }
  | null;

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default function KanbanPage({ params }: Props) {
  const { projectId } = use(params);

  const { data: project, isLoading: projLoading } = useProject(projectId);
  const { data: serverColumns, isLoading: colsLoading } = useProjectColumns(projectId);
  const { data: serverTasks, isLoading: tasksLoading } = useProjectTasks(projectId);

  const moveTask = useMoveTask(projectId);
  const createColumn = useCreateColumn(projectId);
  const deleteColumn = useDeleteColumn(projectId);
  const reorderColumns = useReorderColumns(projectId);

  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>([]);
  const [localTaskMap, setLocalTaskMap] = useState<Record<string, Task[]>>({});
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const [pendingMutations, setPendingMutations] = useState(0);
  const isMutating = pendingMutations > 0;

  const [addingTaskColumnId, setAddingTaskColumnId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [activeTab, setActiveTab] = useState('Board');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const columnIds = useMemo(() => localColumns.map((c) => c.id), [localColumns]);

  function findColumn(id: string): string | undefined {
    for (const [colId, tasks] of Object.entries(localTaskMap)) {
      if (tasks.some((t) => t.id === id)) return colId;
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    const d = active.data.current;
    if (d?.type === 'task') setActiveDrag({ type: 'task', task: d.task });
    if (d?.type === 'column') setActiveDrag({ type: 'column', column: d.column });
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.id === over.id) return;
    if (active.data.current?.type !== 'task') return;

    const overId = over.id as string;
    const overType = over.data.current?.type as string | undefined;
    const srcColId = findColumn(active.id as string);
    if (!srcColId) return;

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
        if (overType !== 'task') return prev;
        const from = srcTasks.findIndex((t) => t.id === active.id);
        const to = srcTasks.findIndex((t) => t.id === overId);
        if (from === -1 || to === -1 || from === to) return prev;
        return { ...prev, [srcColId]: arrayMove(srcTasks, from, to) };
      }

      const movingTask = srcTasks.find((t) => t.id === active.id);
      if (!movingTask) return prev;
      const newSrc = srcTasks.filter((t) => t.id !== active.id);
      const newTgt = [...tgtTasks];
      const moved = { ...movingTask, columnId: tgtColId! };

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
      const to = localColumns.findIndex((c) => c.id === over.id);
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
      onError: () => toast.error('Failed to delete column'),
    });
  };

  const handleLocalRename = (colId: string, name: string) =>
    setLocalColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)));

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
    { name: 'List', icon: List },
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
            {['1', '2', '3'].map((n) => (
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

      {/* Board view */}
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

            <DragOverlay
              dropAnimation={{
                duration: 200,
                easing: 'cubic-bezier(0.18,0.67,0.6,1.22)',
                sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
              }}
            >
              {activeDrag?.type === 'task' && <KanbanCard task={activeDrag.task} overlay />}
              {activeDrag?.type === 'column' && (
                <div className="w-[280px] shadow-2xl rounded-xl opacity-95">
                  <SortableColumn
                    column={activeDrag.column}
                    tasks={localTaskMap[activeDrag.column.id] || []}
                    projectId={projectId}
                    onAddTask={() => {}}
                    onEditTask={() => {}}
                    onDelete={() => {}}
                    onLocalRename={() => {}}
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

      {addingTaskColumnId && serverColumns && (
        <AddTaskModal
          projectId={projectId}
          columns={serverColumns}
          defaultColumnId={addingTaskColumnId}
          onClose={() => setAddingTaskColumnId(null)}
        />
      )}
      {editingTask && (
        <TaskDrawer task={editingTask} projectId={projectId} onClose={() => setEditingTask(null)} />
      )}
    </div>
  );
}
