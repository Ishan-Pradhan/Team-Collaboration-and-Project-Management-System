'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Calendar, ChevronDown, Loader2, User, X, Plus, Trash2,
  Check, MessageSquare, CheckSquare, Paperclip, ChevronRight,
  Eye, FileText, Image as ImageIcon, File, Download, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Task, TaskComment, Subtask, TaskAttachment } from '@/types/project.types';
import { PRIORITY, DUE_STATUS, getDueStatus } from '@/constants/task.constants';
import {
  useUpdateTask, useDeleteTask, useProjectMembers,
  useTaskComments, useCreateComment, useDeleteComment,
  useSubtasks, useCreateSubtask, useToggleSubtask, useDeleteSubtask,
  useTaskAttachments, useUploadAttachment, useDeleteAttachment,
} from '@/hooks/useProject';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';

// ─── helpers ──────────────────────────────────────────────────
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

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon size={14} className="text-blue-500" />;
  if (type === 'application/pdf') return <FileText size={14} className="text-red-500" />;
  return <File size={14} className="text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Tab types ────────────────────────────────────────────────
type Tab = 'details' | 'subtasks' | 'comments' | 'files';

// ─── Main component ───────────────────────────────────────────
interface Props {
  task: Task;
  projectId: string;
  isAdmin: boolean;
  columnName?: string;
  onClose: () => void;
}

export function TaskDrawer({ task, projectId, isAdmin, columnName, onClose }: Props) {
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('details');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="flex w-full max-w-[520px] flex-col border-l border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 pr-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              {isAdmin ? 'Edit Task' : 'Task Details'}
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-base font-semibold text-gray-900">{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/60">
          {([
            { id: 'details', label: 'Details', icon: ChevronRight },
            { id: 'subtasks', label: 'Subtasks', icon: CheckSquare },
            { id: 'comments', label: 'Comments', icon: MessageSquare },
            { id: 'files', label: 'Files', icon: Paperclip },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium transition-colors',
                activeTab === id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && (
            <DetailsTab task={task} projectId={projectId} isAdmin={isAdmin} columnName={columnName} onClose={onClose} />
          )}
          {activeTab === 'subtasks' && (
            <SubtasksTab task={task} projectId={projectId} isAdmin={isAdmin} currentUserId={currentUser?.id ?? ''} />
          )}
          {activeTab === 'comments' && (
            <CommentsTab task={task} projectId={projectId} currentUserId={currentUser?.id ?? ''} isAdmin={isAdmin} />
          )}
          {activeTab === 'files' && (
            <FilesTab task={task} projectId={projectId} currentUserId={currentUser?.id ?? ''} isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Details Tab ─────────────────────────────────────────────
function DetailsTab({ task, projectId, isAdmin, columnName, onClose }: {
  task: Task; projectId: string; isAdmin: boolean; columnName?: string; onClose: () => void;
}) {
  const { data: projectMembers } = useProjectMembers(projectId);
  const updateTask = useUpdateTask(projectId, task.id);
  const deleteTask = useDeleteTask(projectId);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<Task['priority']>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>((task.assignees ?? []).map((a) => a.id));
  const [saving, setSaving] = useState(false);
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

  const handleSave = () => {
    if (!title.trim()) return;
    setSaving(true);
    updateTask.mutate(
      { title: title.trim(), description: description.trim() || null, priority, dueDate: dueDate || null, assigneeIds },
      {
        onSuccess: () => { toast.success('Task updated'); onClose(); },
        onError: (err: unknown) => toast.error(parseApiError(err).message),
        onSettled: () => setSaving(false),
      },
    );
  };

  const handleDelete = () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => { toast.success('Task deleted'); onClose(); },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const p = PRIORITY[task.priority];
  const dueStatus = getDueStatus(task.dueDate, columnName);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-5 px-5 py-4">
        {/* Title */}
        <Field label="Title">
          {isAdmin ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          ) : (
            <p className="text-sm font-medium text-gray-900">{task.title}</p>
          )}
        </Field>

        {/* Description */}
        <Field label="Description">
          {isAdmin ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Add more detail..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none transition"
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {task.description || <span className="italic text-gray-400">No description</span>}
            </p>
          )}
        </Field>

        {/* Priority + Due date row */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Priority">
            {isAdmin ? (
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PRIORITY) as Task['priority'][]).map((px) => (
                  <button
                    key={px}
                    onClick={() => setPriority(px)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all',
                      priority === px
                        ? PRIORITY[px].chip + ' ring-2 ring-offset-1 ring-current border-transparent'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50',
                    )}
                  >
                    {PRIORITY[px].label}
                  </button>
                ))}
              </div>
            ) : (
              <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', p.chip)}>
                {p.label}
              </span>
            )}
          </Field>

          <Field label="Due Date">
            {isAdmin ? (
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm"
              />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm flex items-center gap-1.5 text-gray-700">
                  <Calendar size={13} />
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : <span className="text-gray-400 italic">None</span>}
                </p>
                {dueStatus && (
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', DUE_STATUS[dueStatus].chip)}>
                    {DUE_STATUS[dueStatus].label}
                  </span>
                )}
              </div>
            )}
          </Field>
        </div>

        {/* Assignees */}
        <Field label="Assignees">
          {isAdmin ? (
            <div className="relative" ref={assigneeRef}>
              {/* Selected chips */}
              <div
                onClick={() => setShowAssigneePicker((v) => !v)}
                className="flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {assigneeIds.length === 0 ? (
                  <span className="text-sm text-gray-400 py-0.5">Unassigned — click to add</span>
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
                <ChevronDown size={13} className="ml-auto text-gray-400 shrink-0 self-center" />
              </div>

              {/* Dropdown */}
              {showAssigneePicker && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                  {projectMembers?.map((m) => {
                    if (!m.user) return null;
                    const selected = assigneeIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        onClick={() =>
                          setAssigneeIds((prev) =>
                            selected ? prev.filter((id) => id !== m.userId) : [...prev, m.userId]
                          )
                        }
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                          selected && 'bg-blue-50/60',
                        )}
                      >
                        <Avatar name={m.user.name} url={m.user.avatarUrl} size={6} />
                        <div className="min-w-0 text-left flex-1">
                          <p className="truncate font-medium text-gray-800">{m.user.name}</p>
                          <p className="truncate text-[11px] text-gray-400">{m.user.email}</p>
                        </div>
                        <div className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                          selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200',
                        )}>
                          {selected && <Check size={10} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            task.assignees && task.assignees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {task.assignees.map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 pl-1 pr-2.5 py-0.5">
                    <Avatar name={a.name} url={a.avatarUrl} size={5} />
                    <span className="text-[12px] text-gray-700 font-medium">{a.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-gray-400">Unassigned</p>
            )
          )}
        </Field>

        {/* Meta */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-[11px] text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Created</span>
            <span className="font-medium text-gray-700">
              {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          {task.creator && (
            <div className="flex justify-between">
              <span>By</span>
              <span className="font-medium text-gray-700">{task.creator.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-5 py-3.5 flex items-center justify-between bg-white">
        {isAdmin ? (
          <>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 -ml-2 px-2 text-sm"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              <Trash2 size={14} className="mr-1.5" />Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</> : 'Save Changes'}
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={onClose} className="ml-auto">Close</Button>
        )}
      </div>
    </div>
  );
}

// ─── Subtasks Tab ─────────────────────────────────────────────
function SubtasksTab({ task, projectId, isAdmin, currentUserId }: {
  task: Task; projectId: string; isAdmin: boolean; currentUserId: string;
}) {
  const { data: subtasks = [], isLoading } = useSubtasks(projectId, task.id);
  const createSubtask = useCreateSubtask(projectId, task.id);
  const toggleSubtask = useToggleSubtask(projectId, task.id);
  const deleteSubtask = useDeleteSubtask(projectId, task.id);

  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const completed = subtasks.filter((s) => s.isCompleted).length;
  const pct = subtasks.length ? Math.round((completed / subtasks.length) * 100) : 0;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    createSubtask.mutate(newTitle.trim(), {
      onSuccess: () => { setNewTitle(''); inputRef.current?.focus(); },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Progress */}
      {subtasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>{completed} / {subtasks.length} completed</span>
            <span className="font-semibold text-gray-700">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-gray-300" />
        </div>
      ) : subtasks.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-gray-400">
          <CheckSquare size={28} className="mb-2 opacity-40" />
          <p className="text-sm">No subtasks yet</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {subtasks.map((s: Subtask) => (
            <li
              key={s.id}
              className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 hover:border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <button
                onClick={() => toggleSubtask.mutate(s.id)}
                className={cn(
                  'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                  s.isCompleted
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 hover:border-green-400',
                )}
                style={{ height: 18, width: 18 }}
              >
                {s.isCompleted && <Check size={11} />}
              </button>
              <span className={cn('flex-1 text-sm text-gray-800 leading-snug', s.isCompleted && 'line-through text-gray-400')}>
                {s.title}
              </span>
              {(isAdmin || s.createdById === currentUserId) && (
                <button
                  onClick={() => deleteSubtask.mutate(s.id)}
                  className="shrink-0 rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add new */}
      {(isAdmin || true) && (
        adding ? (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/40 px-3 py-2">
            <input
              ref={inputRef}
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
              }}
              placeholder="Add subtask..."
              className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
            />
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || createSubtask.isPending}
              className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
            <button onClick={() => { setAdding(false); setNewTitle(''); }} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors w-full"
          >
            <Plus size={14} />Add a subtask
          </button>
        )
      )}
    </div>
  );
}

// ─── Comments Tab ─────────────────────────────────────────────
function CommentsTab({ task, projectId, currentUserId, isAdmin }: {
  task: Task; projectId: string; currentUserId: string; isAdmin: boolean;
}) {
  const { data: comments = [], isLoading } = useTaskComments(projectId, task.id);
  const createComment = useCreateComment(projectId, task.id);
  const deleteComment = useDeleteComment(projectId, task.id);

  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    createComment.mutate(text.trim(), {
      onSuccess: () => setText(''),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-gray-300" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-gray-400">
            <MessageSquare size={28} className="mb-2 opacity-40" />
            <p className="text-sm">No comments yet. Start the conversation.</p>
          </div>
        ) : (
          comments.map((c: TaskComment) => {
            const isOwn = c.authorId === currentUserId;
            return (
              <div key={c.id} className="group flex gap-3">
                {c.author && <Avatar name={c.author.name} url={c.author.avatarUrl} size={7} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-gray-800">
                      {c.author?.name ?? 'Unknown'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(c.createdAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                </div>
                {(isOwn || isAdmin) && (
                  <button
                    onClick={() => deleteComment.mutate(c.id)}
                    className="shrink-0 self-start rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all mt-0.5"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-5 py-3.5 bg-white">
        <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-100 transition">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Write a comment… (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400 resize-none leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || createComment.isPending}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-text disabled:opacity-40 hover:bg-primary-hover transition-colors"
          >
            {createComment.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── File Preview Modal ───────────────────────────────────────

function FilePreviewModal({ file, onClose }: { file: TaskAttachment; onClose: () => void }) {
  const isImage = file.fileType.startsWith('image/');
  const isPdf = file.fileType === 'application/pdf';
  const isVideo = file.fileType.startsWith('video/');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85" onClick={onClose}>
      <div className="relative mx-4 flex w-full max-w-4xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="truncate text-sm font-medium text-white">{file.fileName}</p>
          <div className="flex shrink-0 items-center gap-2">
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
            className="max-h-[80vh] w-full rounded-xl object-contain"
          />
        ) : isPdf ? (
          <iframe
            src={file.fileUrl}
            title={file.fileName}
            className="w-full rounded-xl"
            style={{ height: '80vh' }}
          />
        ) : isVideo ? (
          <video
            src={file.fileUrl}
            controls
            className="max-h-[80vh] w-full rounded-xl"
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

// ─── Files Tab ────────────────────────────────────────────────
function FilesTab({ task, projectId, currentUserId, isAdmin }: {
  task: Task; projectId: string; currentUserId: string; isAdmin: boolean;
}) {
  const { data: attachments = [], isLoading } = useTaskAttachments(projectId, task.id);
  const upload = useUploadAttachment(projectId, task.id);
  const deleteAttachment = useDeleteAttachment(projectId, task.id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<TaskAttachment | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => {
      upload.mutate(f, {
        onSuccess: () => toast.success(`${f.name} uploaded`),
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      });
    });
  };

  return (
    <div className="px-5 py-4 space-y-4">
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors cursor-pointer',
          dragging
            ? 'border-blue-400 bg-blue-50/60'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        {upload.isPending ? (
          <Loader2 size={20} className="animate-spin text-blue-500 mb-2" />
        ) : (
          <Paperclip size={20} className="text-gray-300 mb-2" />
        )}
        <p className="text-sm font-medium text-gray-500">
          {upload.isPending ? 'Uploading...' : 'Drop files here or click to upload'}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400">Images, PDFs, docs, videos up to 20 MB</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Files list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-gray-300" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-gray-400">
          <Paperclip size={24} className="mb-2 opacity-30" />
          <p className="text-sm">No files attached yet</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a: TaskAttachment) => (
            <li key={a.id} className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3.5 py-3 hover:border-gray-200 hover:shadow-sm transition">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-100">
                {fileIcon(a.fileType)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-gray-800">{a.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-400">{formatBytes(a.fileSize)}</span>
                  {a.uploadedBy && (
                    <span className="text-[11px] text-gray-400">· {a.uploadedBy.name}</span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    · {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setPreviewFile(a)}
                  className="rounded-md p-1.5 text-gray-400 hover:text-primary hover:bg-brand-soft transition-colors"
                  title="Preview"
                >
                  <Eye size={14} />
                </button>
                <a
                  href={a.fileUrl}
                  download={a.fileName}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md p-1.5 text-gray-400 hover:text-primary hover:bg-brand-soft transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </a>
                {(isAdmin || a.uploadedById === currentUserId) && (
                  <button
                    onClick={() => deleteAttachment.mutate(a.id)}
                    className="rounded-md p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}
