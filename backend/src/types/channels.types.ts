import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';

export interface Channels {
  id: string;
  organizationId: string;
  name: string;
  type: 'PUBLIC' | 'PRIVATE';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ChannelCreationAttributes = Optional<
  Channels,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface ChannelInstance
  extends Model<Channels, ChannelCreationAttributes>, Channels {}

export interface ChannelMembers {
  id: string;
  channelId: string;
  userId: string;
  joinedAt?: Date;
  user?: UserInstance;
  channel?: ChannelInstance;
}

export type ChannelMemberCreationAttributes = Optional<
  ChannelMembers,
  'id' | 'joinedAt'
>;

export interface ChannelMemberInstance
  extends Model<ChannelMembers, ChannelMemberCreationAttributes>, ChannelMembers {}

export interface Messages {
  id: string;
  channelId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM';
  content: string;
  createdAt?: Date;
  sender?: UserInstance;
}

export type MessageCreationAttributes = Optional<
  Messages,
  'id' | 'senderId' | 'type' | 'createdAt'
>;

export interface MessageInstance
  extends Model<Messages, MessageCreationAttributes>, Messages {}
