import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';
import type { ProjectInstance } from './projects.types.js';
import type { KanbanColumnInstance } from './kanbanColumns.types.js';

export interface Tasks {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdById: string;
  dueDate: string | Date | null;
  position: number;
  dueSoonNotificationSent: boolean;
  overdueNotificationSent: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  project?: ProjectInstance;
  column?: KanbanColumnInstance;
  assignees?: UserInstance[];
  creator?: UserInstance;
}

export type TaskCreationAttributes = Optional<
  Tasks,
  | 'id'
  | 'description'
  | 'priority'
  | 'dueDate'
  | 'position'
  | 'dueSoonNotificationSent'
  | 'overdueNotificationSent'
  | 'createdAt'
  | 'updatedAt'
>;

export interface TaskInstance
  extends Model<Tasks, TaskCreationAttributes>, Tasks {}

export interface TaskComments {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
  task?: TaskInstance;
  author?: UserInstance;
}

export type TaskCommentCreationAttributes = Optional<
  TaskComments,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface TaskCommentInstance
  extends Model<TaskComments, TaskCommentCreationAttributes>, TaskComments {}

export interface TaskAttachments {
  id: string;
  taskId: string;
  projectId: string;
  uploadedById: string;
  fileName: string;
  fileUrl: string;
  cloudinaryPublicId: string;
  fileType: string;
  fileSize: number;
  createdAt?: Date;
  updatedAt?: Date;
  uploadedBy?: UserInstance;
}

export type TaskAttachmentCreationAttributes = Optional<
  TaskAttachments,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface TaskAttachmentInstance
  extends Model<TaskAttachments, TaskAttachmentCreationAttributes>, TaskAttachments {}

export interface Subtasks {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: UserInstance;
}

export type SubtaskCreationAttributes = Optional<
  Subtasks,
  'id' | 'isCompleted' | 'position' | 'createdAt' | 'updatedAt'
>;

export interface SubtaskInstance
  extends Model<Subtasks, SubtaskCreationAttributes>, Subtasks {}
