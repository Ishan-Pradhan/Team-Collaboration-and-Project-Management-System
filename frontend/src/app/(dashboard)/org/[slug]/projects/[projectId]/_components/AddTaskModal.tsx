'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Task, KanbanColumn } from '@/types/project.types';
import { PRIORITY } from '@/constants/task.constants';
import { useCreateTask, useProjectMembers } from '@/hooks/useProject';
import { parseApiError } from '@/lib/axios';

const COLORS = ['#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d'];
function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function Avatar({ name, url, size = 6 }: { name: string; url?: string | null; size?: number }) {
  const s = `h-${size} w-${size}`;
  if (url) return <img src={url} alt={name} className={cn(s, 'rounded-full object-cover')} />;
  return (
    <div
      className={cn(s, 'flex shrink-0 items-center justify-center rounded-full text-white font-bold')}
      style={{ backgroundColor: getColor(name), fontSize: size * 1.5 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface Props {
  projectId: string;
  columns: KanbanColumn[];
  defaultColumnId: string;
  onClose: () => void;
}

export function AddTaskModal({ projectId, columns, defaultColumnId, onClose }: Props) {
  const createTask = useCreateTask(projectId);
  const { data: projectMembers } = useProjectMembers(projectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM');
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node))
        setShowAssigneePicker(false);
    };
    if (showAssigneePicker) document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [showAssigneePicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate(
      { title: title.trim(), columnId, description: description.trim() || null, priority, dueDate: dueDate || null, assigneeIds },
      {
        onSuccess: () => { toast.success('Card created'); onClose(); },
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl border border-border-subtle bg-surface p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded p-1 text-text-muted hover:bg-surface-muted transition-colors">
          <X size={16} />
        </button>
        <h2 className="text-base font-semibold text-text-primary">Add Card</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Title *</label>
            <Input autoFocus placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={createTask.isPending} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Column</label>
              <select value={columnId} onChange={(e) => setColumnId(e.target.value)} disabled={createTask.isPending}
                className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                {columns.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])} disabled={createTask.isPending}
                className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                {(Object.keys(PRIORITY) as Task['priority'][]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={createTask.isPending} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Assignees</label>
            <div className="relative" ref={assigneeRef}>
              <div
                onClick={() => !createTask.isPending && setShowAssigneePicker((v) => !v)}
                className="flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 cursor-pointer hover:bg-surface-muted transition-colors"
              >
                {assigneeIds.length === 0 ? (
                  <span className="text-sm text-text-muted py-0.5">Unassigned — click to add</span>
                ) : (
                  projectMembers
                    ?.filter((m) => assigneeIds.includes(m.userId) && m.user)
                    .map((m) => (
                      <span
                        key={m.userId}
                        className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 pl-1 pr-2 py-0.5"
                      >
                        <Avatar name={m.user!.name} url={m.user!.avatarUrl} size={5} />
                        <span className="text-[12px] font-medium text-blue-700">{m.user!.name.split(' ')[0]}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigneeIds((prev) => prev.filter((id) => id !== m.userId));
                          }}
                          className="text-blue-400 hover:text-blue-600 leading-none"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))
                )}
                <ChevronDown size={13} className="ml-auto text-text-muted shrink-0 self-center" />
              </div>

              {showAssigneePicker && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-border-subtle bg-surface py-1 shadow-xl">
                  {projectMembers?.map((m) => {
                    if (!m.user) return null;
                    const selected = assigneeIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() =>
                          setAssigneeIds((prev) =>
                            selected ? prev.filter((id) => id !== m.userId) : [...prev, m.userId]
                          )
                        }
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-muted transition-colors',
                          selected && 'bg-blue-50/60',
                        )}
                      >
                        <Avatar name={m.user.name} url={m.user.avatarUrl} size={6} />
                        <div className="min-w-0 text-left flex-1">
                          <p className="truncate font-medium text-text-primary">{m.user.name}</p>
                          <p className="truncate text-[11px] text-text-muted">{m.user.email}</p>
                        </div>
                        <div className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                          selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-border-subtle',
                        )}>
                          {selected && <Check size={10} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Description <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Add details..."
              disabled={createTask.isPending}
              className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none" />
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
