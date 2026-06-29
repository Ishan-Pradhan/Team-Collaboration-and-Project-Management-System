'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/project.types';
import { PRIORITY } from '@/constants/task.constants';
import { useUpdateTask, useDeleteTask } from '@/hooks/useProject';

interface Props {
  task: Task;
  projectId: string;
  onClose: () => void;
}

export function TaskDrawer({ task, projectId, onClose }: Props) {
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
          <button onClick={onClose} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
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
            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
              <Calendar size={12} /> Due Date
            </label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-auto" />
          </div>
          {task.assignee && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Assignee</label>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white uppercase">
                  {task.assignee.name.charAt(0)}
                </div>
                <span className="text-sm text-gray-800">{task.assignee.name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 -ml-3 px-3" onClick={handleDelete} disabled={deleteTask.isPending}>
            Delete
          </Button>
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
