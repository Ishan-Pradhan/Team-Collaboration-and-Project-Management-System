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
  assigneeId: string | null;
  createdById: string;
  dueDate: string | Date | null;
  position: number;
  dueSoonNotificationSent: boolean;
  overdueNotificationSent: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  project?: ProjectInstance;
  column?: KanbanColumnInstance;
  assignee?: UserInstance;
  creator?: UserInstance;
}

export type TaskCreationAttributes = Optional<
  Tasks,
  | 'id'
  | 'description'
  | 'priority'
  | 'assigneeId'
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
