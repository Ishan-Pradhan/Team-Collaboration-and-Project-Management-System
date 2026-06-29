import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@/types/project.types';
import {
  getOrgProjects,
  getProject,
  createProject,
  updateProject,
  archiveProject,
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
} from '@/services/project.service';

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
      assigneeId?: string | null;
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
      assigneeId?: string | null;
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
