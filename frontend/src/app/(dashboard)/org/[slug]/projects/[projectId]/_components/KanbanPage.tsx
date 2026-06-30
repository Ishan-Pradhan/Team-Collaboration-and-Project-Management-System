'use client';

import { use, useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, CalendarDays, ChevronDown, Download, ExternalLink, Eye, File, FileText, Image as ImageIcon, Layout, List, Loader2, Paperclip, Plus, Settings, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Task, KanbanColumn, TaskAttachment, Project } from '@/types/project.types';
import { useRouter, useSearchParams } from 'next/navigation';
import { PRIORITY, DUE_STATUS, getDueStatus } from '@/constants/task.constants';
import { KanbanSkeleton } from '@/components/shared/skeletons/KanbanSkeleton';
import {
  useProject,
  useProjectColumns,
  useProjectTasks,
  useCreateColumn,
  useDeleteColumn,
  useReorderColumns,
  useMoveTask,
  useProjectMembers,
  useProjectFiles,
  useArchiveProject,
  useUnarchiveProject,
  useDeleteProject,
} from '@/hooks/useProject';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';

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
import ManageProjectMembersModal from '@/components/shared/ManageProjectMembersModal';
import ProjectCalendarView from './ProjectCalendarView';

type ActiveDrag =
  | { type: 'task'; task: Task }
  | { type: 'column'; column: KanbanColumn }
  | null;

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

const MEMBER_COLORS = ['#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d'];
function getMemberColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
}

export default function KanbanPage({ params }: Props) {
  const { slug, projectId } = use(params);
  const searchParams = useSearchParams();

  const { user: currentUser } = useAuthStore();
  const { data: project, isLoading: projLoading } = useProject(projectId);
  const { data: serverColumns, isLoading: colsLoading } = useProjectColumns(projectId);
  const { data: serverTasks, isLoading: tasksLoading } = useProjectTasks(projectId);
  const { data: projectMembers } = useProjectMembers(projectId);
  const { data: org } = useOrganizationBySlug(slug);
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');

  const currentMembership = orgMembers?.find((m) => m.userId === currentUser?.id);
  const myProjectMembership = projectMembers?.find((m) => m.userId === currentUser?.id);
  const isOrgAdmin = org?.ownerId === currentUser?.id || currentMembership?.role === 'ORG_ADMIN';
  const isAdmin = isOrgAdmin || myProjectMembership?.role === 'PROJECT_MANAGER';

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
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [activeTab, setActiveTab] = useState('Board');
  const [mounted, setMounted] = useState(false);
  const handledTaskId = useRef<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Deep-link: open drawer when ?taskId=xxx is in the URL
  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (!taskId || !serverTasks || handledTaskId.current === taskId) return;
    const task = serverTasks.find((t) => t.id === taskId);
    if (task) {
      handledTaskId.current = taskId;
      setEditingTask(task);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [searchParams, serverTasks]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: isAdmin ? 4 : Infinity } })
  );
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
    { name: 'Calendar', icon: CalendarDays },
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
          {projectMembers && projectMembers.length > 0 && (
            <div className="flex -space-x-2">
              {projectMembers.slice(0, 4).map((m) => {
                const name = m.user?.name ?? '?';
                const avatarUrl = m.user?.avatarUrl;
                return avatarUrl ? (
                  <img
                    key={m.id}
                    src={avatarUrl}
                    alt={name}
                    title={name}
                    className="h-7 w-7 rounded-full ring-2 ring-white object-cover"
                  />
                ) : (
                  <div
                    key={m.id}
                    title={name}
                    className="flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-white text-[10px] font-bold text-white"
                    style={{ backgroundColor: getMemberColor(name) }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                );
              })}
              {projectMembers.length > 4 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-white bg-gray-200 text-[10px] font-bold text-gray-600">
                  +{projectMembers.length - 4}
                </div>
              )}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowMembersModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
            >
              <Users size={14} />Members
            </button>
          )}
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
                    isAdmin={isAdmin}
                    onAddTask={setAddingTaskColumnId}
                    onEditTask={setEditingTask}
                    onDelete={handleDeleteColumn}
                    onLocalRename={handleLocalRename}
                  />
                ))}

                {isAdmin && (
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
                )}
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
                    isAdmin={isAdmin}
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
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Column</div>
              <div className="col-span-2">Priority</div>
              <div className="col-span-2">Due Status</div>
              <div className="col-span-2 text-right">Due Date</div>
            </div>
            <div className="divide-y divide-gray-100">
              {allTasks.map((task) => {
                const colName = localColumns.find((c) => c.id === task.columnId)?.name;
                const dueStatus = getDueStatus(task.dueDate, colName);
                return (
                <div key={task.id} onClick={() => setEditingTask(task)}
                  className="grid grid-cols-12 gap-4 px-5 py-3.5 text-sm items-center hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="col-span-4 font-medium text-gray-900 truncate">{task.title}</div>
                  <div className="col-span-2">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                      {localColumns.find((c) => c.id === task.columnId)?.name || '—'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', PRIORITY[task.priority].chip)}>
                      {PRIORITY[task.priority].label}
                    </span>
                  </div>
                  <div className="col-span-2">
                    {dueStatus ? (
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', DUE_STATUS[dueStatus].chip)}>
                        {DUE_STATUS[dueStatus].label}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-gray-400 text-xs">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                  </div>
                </div>
                );
              })}
              {allTasks.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-400">No cards yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'Calendar' ? (
        <ProjectCalendarView
          tasks={allTasks}
          columns={localColumns}
          onOpenTask={setEditingTask}
        />
      ) : activeTab === 'Files' ? (
        <ProjectFilesView projectId={projectId} currentUserId={currentUser?.id ?? ''} isAdmin={isAdmin} />
      ) : (
        <ProjectSettingsView project={project} slug={slug} isAdmin={isAdmin} isOrgAdmin={isOrgAdmin} />
      )}

      {isAdmin && addingTaskColumnId && serverColumns && (
        <AddTaskModal
          projectId={projectId}
          columns={serverColumns}
          defaultColumnId={addingTaskColumnId}
          onClose={() => setAddingTaskColumnId(null)}
        />
      )}
      {editingTask && (
        <TaskDrawer
          task={editingTask}
          columnName={localColumns.find((c) => c.id === editingTask.columnId)?.name}
          projectId={projectId}
          isAdmin={isAdmin}
          onClose={() => setEditingTask(null)}
        />
      )}
      {showMembersModal && project?.organizationId && (
        <ManageProjectMembersModal
          projectId={projectId}
          organizationId={project.organizationId}
          createdById={project.createdById}
          isOpen={showMembersModal}
          isOrgAdmin={isOrgAdmin}
          onClose={() => setShowMembersModal(false)}
        />
      )}
    </div>
  );
}

// ─── Project Settings View ────────────────────────────────────

function ProjectSettingsView({
  project,
  slug,
  isAdmin,
  isOrgAdmin,
}: {
  project: Project;
  slug: string;
  isAdmin: boolean;
  isOrgAdmin: boolean;
}) {
  const router = useRouter();
  const archiveMutation = useArchiveProject(project.id, project.organizationId);
  const unarchiveMutation = useUnarchiveProject(project.id, project.organizationId);
  const deleteMutation = useDeleteProject(project.id, project.organizationId);

  const handleArchive = () => {
    if (!confirm(`Archive "${project.name}"? It will be hidden from active projects and no new tasks can be added.`)) return;
    archiveMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(`"${project.name}" has been archived`);
        router.push(`/org/${slug}/projects`);
      },
      onError: () => toast.error('Failed to archive project'),
    });
  };

  const handleUnarchive = () => {
    unarchiveMutation.mutate(undefined, {
      onSuccess: () => toast.success(`"${project.name}" is now active`),
      onError: () => toast.error('Failed to restore project'),
    });
  };

  const handleDelete = () => {
    if (!confirm(`Permanently delete "${project.name}"? This cannot be undone — all tasks, columns, and files will be lost.`)) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(`"${project.name}" has been deleted`);
        router.push(`/org/${slug}/projects`);
      },
      onError: () => toast.error('Failed to delete project'),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-xl space-y-6">

        {/* Project info */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Project Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-800">{project.name}</span>
            </div>
            {project.description && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Description</span>
                <span className="text-gray-700 text-right">{project.description}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                project.status === 'ACTIVE' ? 'bg-success-soft text-success' : 'bg-surface-muted text-text-muted'
              )}>
                {project.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span className="font-medium text-gray-800">
                {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        {isAdmin && (
          <div className="rounded-xl border border-danger/20 bg-danger-soft/30 p-6 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-danger mb-1">Danger Zone</h2>
              <p className="text-xs text-gray-500">
                {project.status === 'ACTIVE'
                  ? 'Archiving hides the project from active view. All data is preserved and can be restored.'
                  : 'This project is archived. You can restore it to active, or delete it permanently.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {project.status === 'ACTIVE' && (
                <button
                  onClick={handleArchive}
                  disabled={archiveMutation.isPending}
                  className="flex items-center gap-2 rounded-lg border border-danger/30 bg-white px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft transition-colors disabled:opacity-50"
                >
                  {archiveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                  Archive project
                </button>
              )}
              {project.status === 'ARCHIVED' && (
                <button
                  onClick={handleUnarchive}
                  disabled={unarchiveMutation.isPending}
                  className="flex items-center gap-2 rounded-lg border border-success/30 bg-white px-4 py-2 text-sm font-medium text-success hover:bg-success-soft transition-colors disabled:opacity-50"
                >
                  {unarchiveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                  Restore project
                </button>
              )}
              {isOrgAdmin && (
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 rounded-lg border border-danger/30 bg-white px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete permanently
                </button>
              )}
            </div>
          </div>
        )}

        {!isAdmin && (
          <p className="text-center text-sm text-gray-400">Only admins can modify project settings.</p>
        )}
      </div>
    </div>
  );
}

// ─── PDF Viewer (blob-URL approach) ──────────────────────────
// Fetching the PDF as a blob and rendering via a local blob URL bypasses
// Cloudinary's Content-Disposition: attachment header and any X-Frame-Options
// restrictions, so the browser's native PDF viewer renders it inline.

function PdfViewer({ src, height }: { src: string; height: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    setLoading(true);
    setErr(false);
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => { setErr(true); setLoading(false); });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-gray-900"
        style={{ height }}
      >
        <Loader2 size={28} className="animate-spin text-white/30" />
      </div>
    );
  }
  if (err || !blobUrl) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl bg-gray-900 text-gray-400"
        style={{ height }}
      >
        <File size={40} className="opacity-25" />
        <p className="text-sm">Could not load PDF preview</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-brand hover:underline"
        >
          <ExternalLink size={14} /> Open in new tab
        </a>
      </div>
    );
  }
  return (
    <iframe
      src={blobUrl}
      title="PDF preview"
      className="w-full rounded-xl bg-white"
      style={{ height }}
    />
  );
}

// ─── File Preview Modal ───────────────────────────────────────

function FilePreviewModal({ file, onClose }: { file: TaskAttachment; onClose: () => void }) {
  const isImage = file.fileType.startsWith('image/');
  const isPdf = file.fileType === 'application/pdf';
  const isVideo = file.fileType.startsWith('video/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85" onClick={onClose}>
      <div className="relative mx-4 flex w-full max-w-5xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="truncate text-sm font-medium text-white">{file.fileName}</p>
          <div className="flex shrink-0 items-center gap-2">
            {isPdf && (
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                title="Open in new tab"
              >
                <ExternalLink size={16} />
              </a>
            )}
            <a
              href={file.fileUrl}
              download={file.fileName}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              title="Download"
            >
              <Download size={16} />
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {isImage ? (
          <img
            src={file.fileUrl}
            alt={file.fileName}
            className="max-h-[82vh] w-full rounded-xl object-contain"
          />
        ) : isPdf ? (
          <PdfViewer src={file.fileUrl} height="82vh" />
        ) : isVideo ? (
          <video
            src={file.fileUrl}
            controls
            className="max-h-[82vh] w-full rounded-xl"
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl bg-gray-900 p-16 text-gray-400">
            <File size={48} className="mb-4 opacity-30" />
            <p className="text-sm">Preview not available for this file type</p>
            <a
              href={file.fileUrl}
              download={file.fileName}
              className="mt-4 flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover"
            >
              <Download size={14} /> Download instead
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Project Files View ───────────────────────────────────────

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon size={15} className="text-blue-500" />;
  if (type === 'application/pdf') return <FileText size={15} className="text-red-500" />;
  return <File size={15} className="text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProjectFilesView({
  projectId,
  currentUserId,
  isAdmin,
}: {
  projectId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const { data: files = [], isLoading } = useProjectFiles(projectId);
  const [search, setSearch] = useState('');
  const [previewFile, setPreviewFile] = useState<TaskAttachment | null>(null);

  const filtered = files.filter((f: TaskAttachment) =>
    f.fileName.toLowerCase().includes(search.toLowerCase()) ||
    (f.uploadedBy?.name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  // Group by task
  const byTask: Record<string, TaskAttachment[]> = {};
  filtered.forEach((f: TaskAttachment) => {
    if (!byTask[f.taskId]) byTask[f.taskId] = [];
    byTask[f.taskId].push(f);
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Project Files</h2>
          <p className="text-xs text-gray-500 mt-0.5">{files.length} file{files.length !== 1 ? 's' : ''} across all tasks</p>
        </div>
        <Input
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Paperclip size={36} className="mb-3 opacity-25" />
          <p className="text-sm font-medium">No files found</p>
          <p className="text-xs mt-1">Upload files to tasks from the task drawer</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byTask).map(([, taskFiles]) => {
            const first = taskFiles[0];
            return (
              <div key={first.taskId}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1">
                  Task · {first.taskId.slice(0, 8)}…
                </p>
                <div className="rounded-xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-50">
                  {taskFiles.map((f: TaskAttachment) => (
                    <div key={f.id} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                      {f.fileType.startsWith('image/') ? (
                        <img
                          src={f.fileUrl}
                          alt={f.fileName}
                          className="h-10 w-10 rounded-lg object-cover border border-gray-100 shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
                          {fileIcon(f.fileType)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{f.fileName}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                          <span>{formatBytes(f.fileSize)}</span>
                          {f.uploadedBy && <><span>·</span><span>{f.uploadedBy.name}</span></>}
                          <span>·</span>
                          <span>{new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setPreviewFile(f)}
                          className="rounded-md p-1.5 text-gray-400 hover:text-primary hover:bg-brand-soft transition-colors"
                          title="Preview"
                        >
                          <Eye size={15} />
                        </button>
                        <a
                          href={f.fileUrl}
                          download={f.fileName}
                          className="rounded-md p-1.5 text-gray-400 hover:text-primary hover:bg-brand-soft transition-colors"
                          title="Download"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
