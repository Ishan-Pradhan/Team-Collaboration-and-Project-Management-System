import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import type {
  Project,
  ProjectsResponse,
  ProjectResponse,
  ProjectMembersResponse,
  KanbanColumnsResponse,
  TasksResponse,
  TaskResponse,
  Task,
  KanbanColumn,
} from '@/types/project.types';

// ─── Projects ────────────────────────────────────────────────

export const useOrgProjects = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'projects'],
    queryFn: async () => {
      const res = await api.get<ProjectsResponse>(
        `/organizations/${organizationId}/projects`
      );
      return res.data.data;
    },
    enabled: !!organizationId,
  });

export const useProject = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const res = await api.get<ProjectResponse>(`/projects/${projectId}`);
      return res.data.data;
    },
    enabled: !!projectId,
  });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { organizationId: string; name: string; description?: string | null }) => {
      const res = await api.post<ProjectResponse>(
        `/organizations/${data.organizationId}/projects`,
        { name: data.name, description: data.description }
      );
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['organizations', variables.organizationId, 'projects'] });
    },
  });
};

export const useUpdateProject = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name?: string; description?: string | null }) => {
      const res = await api.put<ProjectResponse>(`/projects/${projectId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
};

export const useArchiveProject = (projectId: string, organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.patch<ProjectResponse>(`/projects/${projectId}/archive`);
      return res.data.data;
    },
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
    queryFn: async () => {
      const res = await api.get<ProjectMembersResponse>(`/projects/${projectId}/members`);
      return res.data.data;
    },
    enabled: !!projectId,
  });

// ─── Kanban Columns ──────────────────────────────────────────

export const useProjectColumns = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'columns'],
    queryFn: async () => {
      const res = await api.get<KanbanColumnsResponse>(`/projects/${projectId}/columns`);
      return res.data.data;
    },
    enabled: !!projectId,
  });

export const useCreateColumn = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const res = await api.post<{ success: boolean; data: KanbanColumn }>(
        `/projects/${projectId}/columns`,
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'columns'] });
    },
  });
};

export const useUpdateColumn = (projectId: string, columnId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name?: string; color?: string }) => {
      const res = await api.put<{ success: boolean; data: KanbanColumn }>(
        `/projects/${projectId}/columns/${columnId}`,
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'columns'] });
    },
  });
};

export const useDeleteColumn = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (columnId: string) => {
      await api.delete(`/projects/${projectId}/columns/${columnId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'columns'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
    },
  });
};

export const useReorderColumns = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await api.patch<KanbanColumnsResponse>(
        `/projects/${projectId}/columns/reorder`,
        { orderedIds }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'columns'] });
    },
  });
};

// ─── Tasks ───────────────────────────────────────────────────

export const useProjectTasks = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: async () => {
      const res = await api.get<TasksResponse>(`/projects/${projectId}/tasks`);
      return res.data.data;
    },
    enabled: !!projectId,
  });

export const useCreateTask = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      columnId: string;
      description?: string | null;
      priority?: Task['priority'];
      assigneeId?: string | null;
      dueDate?: string | null;
    }) => {
      const res = await api.post<TaskResponse>(`/projects/${projectId}/tasks`, data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
    },
  });
};

export const useUpdateTask = (projectId: string, taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title?: string;
      description?: string | null;
      priority?: Task['priority'];
      assigneeId?: string | null;
      dueDate?: string | null;
    }) => {
      const res = await api.put<TaskResponse>(
        `/projects/${projectId}/tasks/${taskId}`,
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
    },
  });
};

export const useMoveTask = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { taskId: string; columnId: string; position?: number }) => {
      const res = await api.patch<TaskResponse>(
        `/projects/${projectId}/tasks/${data.taskId}/move`,
        { columnId: data.columnId, position: data.position ?? 0 }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
    },
  });
};

export const useDeleteTask = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/projects/${projectId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
    },
  });
};

export const useAddProjectMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post(`/projects/${projectId}/members`, { userId });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
    },
  });
};

export const useRemoveProjectMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/projects/${projectId}/members/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
    },
  });
};
