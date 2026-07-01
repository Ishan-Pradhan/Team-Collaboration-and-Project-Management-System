import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@/types/project.types';
import {
  getOrgDashboard,
  getOrgProjects,
  getProject,
  createProject,
  updateProject,
  archiveProject,
  unarchiveProject,
  deleteProject,
  getProjectMembers,
  getProjectColumns,
  createColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
  getProjectTasks,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  getTaskComments,
  createTaskComment,
  deleteTaskComment,
  getSubtasks,
  createSubtask,
  toggleSubtask,
  deleteSubtask,
  getTaskAttachments,
  uploadTaskAttachment,
  deleteTaskAttachment,
  getProjectFiles,
} from '@/services/project.service';

// ─── Dashboard ───────────────────────────────────────────────

export const useOrgDashboard = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'dashboard'],
    queryFn: () => getOrgDashboard(organizationId),
    enabled: !!organizationId,
  });

// ─── Projects ────────────────────────────────────────────────

export const useOrgProjects = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'projects'],
    queryFn: () => getOrgProjects(organizationId),
    enabled: !!organizationId,
  });

export const useProject = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['organizations', variables.organizationId, 'projects'] });
    },
  });
};

export const useUpdateProject = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string | null }) =>
      updateProject(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId] }),
  });
};

export const useArchiveProject = (projectId: string, organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => archiveProject(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'projects'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
};

export const useUnarchiveProject = (projectId: string, organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unarchiveProject(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'projects'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
};

export const useDeleteProject = (projectId: string, organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'projects'] });
    },
  });
};

// ─── Project Members ─────────────────────────────────────────

export const useProjectMembers = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => getProjectMembers(projectId),
    enabled: !!projectId,
  });

// ─── Kanban Columns ──────────────────────────────────────────

export const useProjectColumns = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'columns'],
    queryFn: () => getProjectColumns(projectId),
    enabled: !!projectId,
  });

export const useCreateColumn = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => createColumn(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'columns'] }),
  });
};

export const useUpdateColumn = (projectId: string, columnId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; color?: string }) =>
      updateColumn(projectId, columnId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'columns'] }),
  });
};

export const useDeleteColumn = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => deleteColumn(projectId, columnId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'columns'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
    },
  });
};

export const useReorderColumns = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderColumns(projectId, orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'columns'] }),
  });
};

// ─── Tasks ───────────────────────────────────────────────────

export const useProjectTasks = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => getProjectTasks(projectId),
    enabled: !!projectId,
  });

export const useCreateTask = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      columnId: string;
      description?: string | null;
      priority?: Task['priority'];
      assigneeIds?: string[];
      dueDate?: string | null;
    }) => createTask(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
  });
};

export const useUpdateTask = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      description?: string | null;
      priority?: Task['priority'];
      assigneeIds?: string[];
      dueDate?: string | null;
    }) => updateTask(projectId, taskId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
  });
};

export const useMoveTask = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { taskId: string; columnId: string; position?: number }) =>
      moveTask(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
  });
};

export const useDeleteTask = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(projectId, taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
  });
};

export const useAddProjectMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => addProjectMember(projectId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  });
};

export const useRemoveProjectMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  });
};

export const useUpdateProjectMemberRole = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'PROJECT_MANAGER' | 'MEMBER' }) =>
      updateProjectMemberRole(projectId, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  });
};

// ─── Comments ────────────────────────────────────────────────

export const useTaskComments = (projectId: string, taskId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'comments'],
    queryFn: () => getTaskComments(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });

export const useCreateComment = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createTaskComment(projectId, taskId, content),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'comments'] }),
  });
};

export const useDeleteComment = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteTaskComment(projectId, taskId, commentId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'comments'] }),
  });
};

// ─── Subtasks ────────────────────────────────────────────────

export const useSubtasks = (projectId: string, taskId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'subtasks'],
    queryFn: () => getSubtasks(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });

export const useCreateSubtask = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => createSubtask(projectId, taskId, title),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'subtasks'] }),
  });
};

export const useToggleSubtask = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) => toggleSubtask(projectId, taskId, subtaskId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'subtasks'] }),
  });
};

export const useDeleteSubtask = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) => deleteSubtask(projectId, taskId, subtaskId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'subtasks'] }),
  });
};

// ─── Attachments ─────────────────────────────────────────────

export const useTaskAttachments = (projectId: string, taskId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'attachments'],
    queryFn: () => getTaskAttachments(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });

export const useUploadAttachment = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadTaskAttachment(projectId, taskId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'attachments'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'files'] });
    },
  });
};

export const useDeleteAttachment = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => deleteTaskAttachment(projectId, taskId, attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'attachments'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'files'] });
    },
  });
};

export const useProjectFiles = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'files'],
    queryFn: () => getProjectFiles(projectId),
    enabled: !!projectId,
  });
