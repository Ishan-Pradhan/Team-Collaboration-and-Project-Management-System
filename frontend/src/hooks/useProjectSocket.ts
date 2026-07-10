'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket } from '@/lib/socket';

// A single socket connection is joined to every project room the user
// belongs to (see backend/src/socket/index.ts), not just the one currently
// open — so every handler here filters by projectId before invalidating,
// the same guard pattern useChatSocket uses for org-wide channel events.
export function useProjectSocket(projectId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const socket = connectSocket();

    const tasksKey = { queryKey: ['projects', projectId, 'tasks'] };
    const columnsKey = { queryKey: ['projects', projectId, 'columns'] };
    const filesKey = { queryKey: ['projects', projectId, 'files'] };

    const onTaskChanged = (task: { projectId: string }) => {
      if (task.projectId !== projectId) return;
      qc.invalidateQueries(tasksKey);
    };

    const onTaskDeleted = ({ projectId: eventProjectId }: { id: string; projectId: string }) => {
      if (eventProjectId !== projectId) return;
      qc.invalidateQueries(tasksKey);
    };

    const onColumnChanged = (column: { projectId: string }) => {
      if (column.projectId !== projectId) return;
      qc.invalidateQueries(columnsKey);
    };

    const onColumnDeleted = ({ projectId: eventProjectId }: { id: string; projectId: string }) => {
      if (eventProjectId !== projectId) return;
      qc.invalidateQueries(columnsKey);
    };

    const onColumnReordered = ({ projectId: eventProjectId }: { projectId: string }) => {
      if (eventProjectId !== projectId) return;
      qc.invalidateQueries(columnsKey);
    };

    const onTaskSubResourceChanged = ({ taskId, projectId: eventProjectId }: { taskId: string; projectId: string }) => {
      if (eventProjectId !== projectId) return;
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'comments'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'subtasks'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'attachments'] });
      // Comment/subtask/attachment counts are aggregated onto the task list response.
      qc.invalidateQueries(tasksKey);
      qc.invalidateQueries(filesKey);
    };

    socket.on('task:created', onTaskChanged);
    socket.on('task:updated', onTaskChanged);
    socket.on('task:moved', onTaskChanged);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('column:created', onColumnChanged);
    socket.on('column:updated', onColumnChanged);
    socket.on('column:deleted', onColumnDeleted);
    socket.on('column:reordered', onColumnReordered);
    socket.on('task:comment:created', onTaskSubResourceChanged);
    socket.on('task:comment:deleted', onTaskSubResourceChanged);
    socket.on('task:subtask:created', onTaskSubResourceChanged);
    socket.on('task:subtask:updated', onTaskSubResourceChanged);
    socket.on('task:subtask:deleted', onTaskSubResourceChanged);
    socket.on('task:attachment:created', onTaskSubResourceChanged);
    socket.on('task:attachment:deleted', onTaskSubResourceChanged);

    return () => {
      socket.off('task:created', onTaskChanged);
      socket.off('task:updated', onTaskChanged);
      socket.off('task:moved', onTaskChanged);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('column:created', onColumnChanged);
      socket.off('column:updated', onColumnChanged);
      socket.off('column:deleted', onColumnDeleted);
      socket.off('column:reordered', onColumnReordered);
      socket.off('task:comment:created', onTaskSubResourceChanged);
      socket.off('task:comment:deleted', onTaskSubResourceChanged);
      socket.off('task:subtask:created', onTaskSubResourceChanged);
      socket.off('task:subtask:updated', onTaskSubResourceChanged);
      socket.off('task:subtask:deleted', onTaskSubResourceChanged);
      socket.off('task:attachment:created', onTaskSubResourceChanged);
      socket.off('task:attachment:deleted', onTaskSubResourceChanged);
    };
  }, [projectId, qc]);

  // No disconnect-on-unmount here, deliberately. The socket is a single
  // shared connection whose lifecycle is owned by useNotificationSocket
  // (mounted for the whole dashboard session in DashboardLayout). This hook
  // mounts/unmounts far more often — every time a Kanban board opens or
  // closes — and calling disconnectSocket() on its own unmount would kill
  // chat and notifications for the rest of the session every time someone
  // navigates away from a project.
}
