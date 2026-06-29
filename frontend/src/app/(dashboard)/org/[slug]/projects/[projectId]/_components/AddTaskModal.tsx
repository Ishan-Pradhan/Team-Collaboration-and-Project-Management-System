'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Task, KanbanColumn } from '@/types/project.types';
import { PRIORITY } from '@/constants/task.constants';
import { useCreateTask } from '@/hooks/useProject';
import { parseApiError } from '@/lib/axios';

interface Props {
  projectId: string;
  columns: KanbanColumn[];
  defaultColumnId: string;
  onClose: () => void;
}

export function AddTaskModal({ projectId, columns, defaultColumnId, onClose }: Props) {
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
            <label className="text-xs font-semibold text-gray-500">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Add details..."
              disabled={createTask.isPending}
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
