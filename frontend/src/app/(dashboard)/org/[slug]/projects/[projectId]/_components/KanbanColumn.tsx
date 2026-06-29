'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Calendar, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, KanbanColumn } from '@/types/project.types';
import { PRIORITY } from '@/constants/task.constants';
import { useUpdateColumn } from '@/hooks/useProject';

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';

const MEMBER_COLORS = ['#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d'];
function getMemberColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
}

// ─── KanbanCard ───────────────────────────────────────────────
export function KanbanCard({
  task,
  isAdmin = true,
  onEdit,
  overlay = false,
}: {
  task: Task;
  isAdmin?: boolean;
  onEdit?: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled: overlay || !isAdmin,
  });

  const p = PRIORITY[task.priority];
  const overdue = task.dueDate && !overlay && new Date(task.dueDate) < new Date();

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={overlay ? undefined : onEdit}
      style={overlay ? undefined : { transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group relative flex flex-col gap-2.5 rounded-lg border bg-white',
        'px-3.5 pb-3 pt-3 select-none touch-none outline-none',
        overlay
          ? 'shadow-2xl border-gray-300 cursor-grabbing scale-[1.03]'
          : isAdmin
            ? 'cursor-grab border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-shadow duration-100 active:cursor-grabbing'
            : 'cursor-pointer border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-shadow duration-100',
        isDragging && !overlay && 'opacity-0',
      )}
    >
      <span className={cn('absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full', p.bar)} />
      <p className="pl-3 pr-1 text-[13px] font-medium leading-snug text-gray-900">{task.title}</p>

      <div className="flex items-center justify-between pl-3">
        {task.assignees && task.assignees.length > 0 ? (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              a.avatarUrl ? (
                <img
                  key={a.id}
                  src={a.avatarUrl}
                  alt={a.name}
                  title={a.name}
                  className="h-5 w-5 rounded-full object-cover ring-1 ring-white"
                />
              ) : (
                <div
                  key={a.id}
                  title={a.name}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white uppercase ring-1 ring-white"
                  style={{ backgroundColor: getMemberColor(a.name) }}
                >
                  {a.name.charAt(0)}
                </div>
              )
            ))}
            {task.assignees.length > 3 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[9px] font-bold text-gray-600 ring-1 ring-white">
                +{task.assignees.length - 3}
              </div>
            )}
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
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', p.chip)}>{p.label}</span>
        </div>
      </div>
    </div>
  );
}

// ─── ColumnTaskArea ───────────────────────────────────────────
function ColumnTaskArea({
  columnId,
  tasks,
  isAdmin,
  onEditTask,
}: {
  columnId: string;
  tasks: Task[];
  isAdmin: boolean;
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
          'flex flex-col gap-2 px-2 pb-1 min-h-[56px] rounded-lg transition-colors duration-150',
          isOver && tasks.length === 0 && 'bg-blue-50/60 outline-dashed outline-2 outline-blue-200',
        )}
      >
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} isAdmin={isAdmin} onEdit={() => onEditTask(task)} />
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
    <div className={cn('flex w-full flex-col rounded-xl bg-[#f1f2f4]', isDraggingColumn && 'opacity-40')}>
      <div className="flex items-center gap-1 px-2.5 pt-2.5 pb-2">
        {isAdmin && (
          <div
            {...colDragHandleProps}
            className="shrink-0 cursor-grab p-1 text-gray-400 hover:text-gray-600 transition-colors touch-none"
          >
            <GripVertical size={14} />
          </div>
        )}

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
          <h3 className="flex-1 min-w-0 truncate text-[13px] font-bold text-gray-700 select-none pl-1">{column.name}</h3>
        )}

        <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-500 select-none">
          {tasks.length}
        </span>

        {isAdmin && (
          <button
            onClick={() => onAddTask(column.id)}
            className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            title="Add card"
          >
            <Plus size={14} />
          </button>
        )}

        {isAdmin && (
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
        )}
      </div>

      <ColumnTaskArea columnId={column.id} tasks={tasks} isAdmin={isAdmin} onEditTask={onEditTask} />

      {isAdmin && (
        <button
          onClick={() => onAddTask(column.id)}
          className="mx-2 mb-2 flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
        >
          <Plus size={14} /> Add a card
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
