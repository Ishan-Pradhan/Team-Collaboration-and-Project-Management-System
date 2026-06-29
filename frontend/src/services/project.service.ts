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

export async function getOrgProjects(organizationId: string): Promise<Project[]> {
  const res = await api.get<ProjectsResponse>(`/organizations/${organizationId}/projects`);
  return res.data.data;
}

export async function getProject(projectId: string): Promise<Project> {
  const res = await api.get<ProjectResponse>(`/projects/${projectId}`);
  return res.data.data;
}

export async function createProject(data: {
  organizationId: string;
  name: string;
  description?: string | null;
}): Promise<Project> {
  const res = await api.post<ProjectResponse>(
    `/organizations/${data.organizationId}/projects`,
    { name: data.name, description: data.description }
  );
  return res.data.data;
}

export async function updateProject(
  projectId: string,
  data: { name?: string; description?: string | null },
): Promise<Project> {
  const res = await api.put<ProjectResponse>(`/projects/${projectId}`, data);
  return res.data.data;
}

export async function archiveProject(projectId: string): Promise<Project> {
  const res = await api.patch<ProjectResponse>(`/projects/${projectId}/archive`);
  return res.data.data;
}

export async function getProjectMembers(projectId: string) {
  const res = await api.get<ProjectMembersResponse>(`/projects/${projectId}/members`);
  return res.data.data;
}

export async function getProjectColumns(projectId: string): Promise<KanbanColumn[]> {
  const res = await api.get<KanbanColumnsResponse>(`/projects/${projectId}/columns`);
  return res.data.data;
}

export async function createColumn(
  projectId: string,
  data: { name: string; color?: string },
): Promise<KanbanColumn> {
  const res = await api.post<{ success: boolean; data: KanbanColumn }>(
    `/projects/${projectId}/columns`,
    data
  );
  return res.data.data;
}

export async function updateColumn(
  projectId: string,
  columnId: string,
  data: { name?: string; color?: string },
): Promise<KanbanColumn> {
  const res = await api.put<{ success: boolean; data: KanbanColumn }>(
    `/projects/${projectId}/columns/${columnId}`,
    data
  );
  return res.data.data;
}

export async function deleteColumn(projectId: string, columnId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/columns/${columnId}`);
}

export async function reorderColumns(
  projectId: string,
  orderedIds: string[],
): Promise<KanbanColumn[]> {
  const res = await api.patch<KanbanColumnsResponse>(
    `/projects/${projectId}/columns/reorder`,
    { orderedIds }
  );
  return res.data.data;
}

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const res = await api.get<TasksResponse>(`/projects/${projectId}/tasks`);
  return res.data.data;
}

export async function createTask(
  projectId: string,
  data: {
    title: string;
    columnId: string;
    description?: string | null;
    priority?: Task['priority'];
    assigneeId?: string | null;
    dueDate?: string | null;
  },
): Promise<Task> {
  const res = await api.post<TaskResponse>(`/projects/${projectId}/tasks`, data);
  return res.data.data;
}

export async function updateTask(
  projectId: string,
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    priority?: Task['priority'];
    assigneeId?: string | null;
    dueDate?: string | null;
  },
): Promise<Task> {
  const res = await api.put<TaskResponse>(`/projects/${projectId}/tasks/${taskId}`, data);
  return res.data.data;
}

export async function moveTask(
  projectId: string,
  data: { taskId: string; columnId: string; position?: number },
): Promise<Task> {
  const res = await api.patch<TaskResponse>(
    `/projects/${projectId}/tasks/${data.taskId}/move`,
    { columnId: data.columnId, position: data.position ?? 0 }
  );
  return res.data.data;
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/tasks/${taskId}`);
}

export async function addProjectMember(projectId: string, userId: string) {
  const res = await api.post(`/projects/${projectId}/members`, { userId });
  return res.data.data;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/members/${userId}`);
}
