import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';

export interface Notifications {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt?: Date;
  user?: UserInstance;
}

export type NotificationCreationAttributes = Optional<
  Notifications,
  'id' | 'body' | 'entityType' | 'entityId' | 'isRead' | 'createdAt'
>;

export interface NotificationInstance
  extends Model<Notifications, NotificationCreationAttributes>, Notifications {}
