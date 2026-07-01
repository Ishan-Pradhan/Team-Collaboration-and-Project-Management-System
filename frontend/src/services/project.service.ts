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
  TaskComment,
  Subtask,
  TaskAttachment,
  DashboardData,
} from '@/types/project.types';

export async function getOrgDashboard(organizationId: string): Promise<DashboardData> {
  const res = await api.get<{ success: boolean; data: DashboardData }>(
    `/organizations/${organizationId}/dashboard`
  );
  return res.data.data;
}

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

export async function unarchiveProject(projectId: string): Promise<Project> {
  const res = await api.patch<ProjectResponse>(`/projects/${projectId}/unarchive`);
  return res.data.data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await api.delete(`/projects/${projectId}`);
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
    assigneeIds?: string[];
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
    assigneeIds?: string[];
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

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: 'PROJECT_MANAGER' | 'MEMBER',
): Promise<void> {
  await api.patch(`/projects/${projectId}/members/${userId}/role`, { role });
}

// ─── Comments ──────────────────────────────────────────────────

export async function getTaskComments(projectId: string, taskId: string): Promise<TaskComment[]> {
  const res = await api.get<{ success: boolean; data: TaskComment[] }>(
    `/projects/${projectId}/tasks/${taskId}/comments`
  );
  return res.data.data;
}

export async function createTaskComment(
  projectId: string,
  taskId: string,
  content: string,
): Promise<TaskComment> {
  const res = await api.post<{ success: boolean; data: TaskComment }>(
    `/projects/${projectId}/tasks/${taskId}/comments`,
    { content }
  );
  return res.data.data;
}

export async function deleteTaskComment(
  projectId: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  await api.delete(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`);
}

// ─── Subtasks ──────────────────────────────────────────────────

export async function getSubtasks(projectId: string, taskId: string): Promise<Subtask[]> {
  const res = await api.get<{ success: boolean; data: Subtask[] }>(
    `/projects/${projectId}/tasks/${taskId}/subtasks`
  );
  return res.data.data;
}

export async function createSubtask(
  projectId: string,
  taskId: string,
  title: string,
): Promise<Subtask> {
  const res = await api.post<{ success: boolean; data: Subtask }>(
    `/projects/${projectId}/tasks/${taskId}/subtasks`,
    { title }
  );
  return res.data.data;
}

export async function toggleSubtask(
  projectId: string,
  taskId: string,
  subtaskId: string,
): Promise<Subtask> {
  const res = await api.patch<{ success: boolean; data: Subtask }>(
    `/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}/toggle`
  );
  return res.data.data;
}

export async function deleteSubtask(
  projectId: string,
  taskId: string,
  subtaskId: string,
): Promise<void> {
  await api.delete(`/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`);
}

// ─── Attachments ───────────────────────────────────────────────

export async function getTaskAttachments(
  projectId: string,
  taskId: string,
): Promise<TaskAttachment[]> {
  const res = await api.get<{ success: boolean; data: TaskAttachment[] }>(
    `/projects/${projectId}/tasks/${taskId}/attachments`
  );
  return res.data.data;
}

export async function uploadTaskAttachment(
  projectId: string,
  taskId: string,
  file: File,
): Promise<TaskAttachment> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ success: boolean; data: TaskAttachment }>(
    `/projects/${projectId}/tasks/${taskId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.data;
}

export async function deleteTaskAttachment(
  projectId: string,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  await api.delete(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`);
}

export async function getProjectFiles(projectId: string): Promise<TaskAttachment[]> {
  const res = await api.get<{ success: boolean; data: TaskAttachment[] }>(
    `/projects/${projectId}/files`
  );
  return res.data.data;
}
