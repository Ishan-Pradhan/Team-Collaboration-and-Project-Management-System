import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';
import type { ProjectInstance } from './projects.types.js';

export interface ChatMessages {
  id: string;
  projectId: string;
  senderId: string;
  content: string;
  createdAt?: Date;
  project?: ProjectInstance;
  sender?: UserInstance;
}

export type ChatMessageCreationAttributes = Optional<
  ChatMessages,
  'id' | 'createdAt'
>;

export interface ChatMessageInstance
  extends Model<ChatMessages, ChatMessageCreationAttributes>, ChatMessages {}
