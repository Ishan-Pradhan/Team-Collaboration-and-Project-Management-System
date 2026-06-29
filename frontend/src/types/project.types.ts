// ─── Project ───────────────────────────────────────────────────

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Project Member ────────────────────────────────────────────

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

// ─── Kanban Column ─────────────────────────────────────────────

export interface KanbanColumn {
  id: string;
  projectId: string;
  name: string;
  position: number;
  color: string | null;
}

// ─── Task ──────────────────────────────────────────────────────

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Task {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: number;
  dueDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  assignees?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  }[];
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

// ─── Comment ───────────────────────────────────────────────────

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

// ─── Subtask ───────────────────────────────────────────────────

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Attachment ────────────────────────────────────────────────

export interface TaskAttachment {
  id: string;
  taskId: string;
  projectId: string;
  uploadedById: string;
  fileName: string;
  fileUrl: string;
  cloudinaryPublicId: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

// ─── API Response wrappers ─────────────────────────────────────

export interface ProjectsResponse {
  success: boolean;
  message: string;
  data: Project[];
}

export interface ProjectResponse {
  success: boolean;
  message: string;
  data: Project;
}

export interface ProjectMembersResponse {
  success: boolean;
  message: string;
  data: ProjectMember[];
}

export interface KanbanColumnsResponse {
  success: boolean;
  message: string;
  data: KanbanColumn[];
}

export interface TasksResponse {
  success: boolean;
  message: string;
  data: Task[];
}

export interface TaskResponse {
  success: boolean;
  message: string;
  data: Task;
}
