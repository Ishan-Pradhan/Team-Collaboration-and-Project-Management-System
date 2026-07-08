'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Calendar, GripVertical, MessageSquare, MoreHorizontal, Paperclip, Pencil, Plus, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, KanbanColumn } from '@/types/project.types';
import { PRIORITY, DUE_STATUS, getDueStatus } from '@/constants/task.constants';
import { useUpdateColumn } from '@/hooks/useProject';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';

const AVATAR_COLORS = ['#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── KanbanCard ───────────────────────────────────────────────
export function KanbanCard({
  task,
  columnName,
  isAdmin = true,
  currentUserId,
  onEdit,
  overlay = false,
}: {
  task: Task;
  columnName?: string;
  isAdmin?: boolean;
  currentUserId?: string;
  onEdit?: () => void;
  overlay?: boolean;
}) {
  const isAssignee = (task.assignees ?? []).some((a) => a.id === currentUserId);
  const canDrag = isAdmin || isAssignee;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled: overlay || !canDrag,
  });

  const p = PRIORITY[task.priority];
  const dueStatus = overlay ? null : getDueStatus(task.dueDate, columnName);
  const subtaskCount = task.subtaskCount ?? 0;
  const subtaskDone = task.subtaskCompletedCount ?? 0;
  const commentCount = task.commentCount ?? 0;
  const attachmentCount = task.attachmentCount ?? 0;
  const isUrgent = dueStatus === 'overdue' || dueStatus === 'due-today' || dueStatus === 'due-soon';

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={overlay ? undefined : onEdit}
      style={overlay ? undefined : { transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex flex-col gap-2.5 rounded-lg border border-border-subtle bg-surface px-3.5 py-3 select-none touch-none outline-none transition-colors',
        overlay
          ? 'shadow-lg rotate-[1deg] opacity-95 cursor-grabbing'
          : canDrag
            ? 'cursor-grab hover:border-border-muted active:cursor-grabbing'
            : 'cursor-pointer hover:border-border-muted',
        isDragging && !overlay && 'opacity-0',
      )}
    >
      {/* Row 1 — Priority chip + urgency badge */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[0.7rem] font-semibold', p.chip)}>
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', p.bar)} />
          {p.label}
        </span>
        {isUrgent && dueStatus && (
          <span className={cn('rounded px-1.5 py-0.5 text-[0.65rem] font-semibold', DUE_STATUS[dueStatus].chip)}>
            {DUE_STATUS[dueStatus].label}
          </span>
        )}
      </div>

      {/* Row 2 — Title */}
      <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
        {task.title}
      </p>

      {/* Row 3 — Description (optional) */}
      {task.description && (
        <p className="text-xs text-text-muted line-clamp-1 leading-relaxed -mt-1">
          {task.description}
        </p>
      )}

      {/* Row 4 — Subtask progress (optional) */}
      {subtaskCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={cn('h-full rounded-full', subtaskDone === subtaskCount ? 'bg-success' : 'bg-border-muted')}
              style={{ width: `${(subtaskDone / subtaskCount) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-text-muted">
            {subtaskDone}/{subtaskCount}
          </span>
        </div>
      )}

      {/* Row 5 — Footer */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {/* Due date */}
        <div>
          {task.dueDate ? (
            <span className={cn(
              'flex items-center gap-1 text-xs font-medium',
              dueStatus === 'overdue' ? 'text-danger' :
              isUrgent ? 'text-warning' : 'text-text-muted',
            )}>
              <Calendar size={11} strokeWidth={2} />
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          ) : (
            <span className="text-xs text-text-muted">No due date</span>
          )}
        </div>

        {/* Counts + assignees */}
        <div className="flex items-center gap-2.5">
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <MessageSquare size={11} strokeWidth={2} />
              {commentCount}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Paperclip size={11} strokeWidth={2} />
              {attachmentCount}
            </span>
          )}
          {task.assignees && task.assignees.length > 0 ? (
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a) =>
                a.avatarUrl ? (
                  <img key={a.id} src={a.avatarUrl} alt={a.name} title={a.name}
                    className="h-5 w-5 rounded-full object-cover ring-[1.5px] ring-surface" />
                ) : (
                  <div key={a.id} title={a.name}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-bold text-white uppercase ring-[1.5px] ring-surface"
                    style={{ backgroundColor: avatarColor(a.name) }}>
                    {a.name.charAt(0)}
                  </div>
                )
              )}
              {task.assignees.length > 3 && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-muted text-[0.6rem] font-semibold text-text-secondary ring-[1.5px] ring-surface">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border-muted text-text-muted">
              <User size={10} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ColumnTaskArea ───────────────────────────────────────────
function ColumnTaskArea({
  columnId,
  columnName,
  tasks,
  isAdmin,
  currentUserId,
  onEditTask,
}: {
  columnId: string;
  columnName: string;
  tasks: Task[];
  isAdmin: boolean;
  currentUserId?: string;
  onEditTask: (t: Task) => void;
}) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const { setNodeRef, isOver } = useDroppable({
    id: `col-drop-${columnId}`,
    data: { type: 'column', columnId },
  });

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 px-2 pb-1 min-h-[48px] overflow-y-auto max-h-[calc(100vh-230px)]',
          'rounded-md transition-colors duration-100',
          isOver && 'bg-primary/10',
        )}
      >
        {tasks.length === 0 && !isOver && (
          <div className="flex h-10 items-center justify-center rounded border border-dashed border-border-muted">
            <span className="text-xs text-text-muted">Empty</span>
          </div>
        )}
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            columnName={columnName}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onEdit={() => onEditTask(task)}
          />
        ))}
      </div>
    </SortableContext>
  );
}

// ─── KanbanColumnInner ────────────────────────────────────────
function KanbanColumnInner({
  column,
  tasks,
  projectId,
  isAdmin,
  currentUserId,
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
  isAdmin: boolean;
  currentUserId?: string;
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
      'flex w-full flex-col rounded-xl bg-surface-muted/50',
      isDraggingColumn && 'opacity-40',
    )}>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2.5">
        {isAdmin && (
          <div {...colDragHandleProps}
            className="shrink-0 cursor-grab rounded p-0.5 text-text-muted hover:text-text-secondary touch-none transition-colors">
            <GripVertical size={14} />
          </div>
        )}

        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: column.color ?? 'var(--color-border-muted)' }}
        />

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
            className="flex-1 min-w-0 rounded border border-primary bg-surface px-2 py-0.5 text-sm font-semibold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <h3 className="flex-1 min-w-0 truncate text-sm font-semibold text-text-primary select-none">
            {column.name}
          </h3>
        )}

        <span className="shrink-0 text-xs font-medium text-text-muted select-none">
          {tasks.length}
        </span>

        {isAdmin && (
          <button onClick={() => onAddTask(column.id)}
            className="shrink-0 rounded-md p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Add task">
            <Plus size={14} />
          </button>
        )}

        {isAdmin && (
          <div ref={menuRef} className="relative shrink-0">
            <button onClick={() => setMenuOpen((o) => !o)}
              className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border-subtle bg-surface py-1 shadow-lg">
                <button
                  onClick={() => { setRenaming(true); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Pencil size={13} className="text-text-muted" /> Rename
                </button>
                <div className="mx-2 my-0.5 border-t border-border-subtle" />
                <button
                  onClick={() => { onDelete(column.id); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tasks */}
      <ColumnTaskArea
        columnId={column.id}
        columnName={column.name}
        tasks={tasks}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        onEditTask={onEditTask}
      />

      {/* Add task footer */}
      {isAdmin && (
        <button
          onClick={() => onAddTask(column.id)}
          className="mx-2 mb-2 mt-1.5 flex w-[calc(100%-16px)] items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Plus size={14} />
          Add a task
        </button>
      )}
    </div>
  );
}

// ─── SortableColumn (exported) ────────────────────────────────
export function SortableColumn(props: {
  column: KanbanColumn;
  tasks: Task[];
  projectId: string;
  isAdmin: boolean;
  currentUserId?: string;
  onAddTask: (id: string) => void;
  onEditTask: (t: Task) => void;
  onDelete: (id: string) => void;
  onLocalRename: (id: string, name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.column.id,
    data: { type: 'column', column: props.column },
    disabled: !props.isAdmin,
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
