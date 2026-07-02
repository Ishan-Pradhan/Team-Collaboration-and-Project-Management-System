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
  type: 'TEXT' | 'SYSTEM' | 'FILE';
  content: string;
  createdAt?: Date;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  cloudinaryPublicId?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  sender?: UserInstance;
}

export type MessageCreationAttributes = Optional<
  Messages,
  | 'id'
  | 'senderId'
  | 'type'
  | 'createdAt'
  | 'deletedAt'
  | 'deletedBy'
  | 'fileName'
  | 'fileUrl'
  | 'cloudinaryPublicId'
  | 'fileType'
  | 'fileSize'
>;

export interface MessageInstance
  extends Model<Messages, MessageCreationAttributes>, Messages {}

export interface MessageReactions {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt?: Date;
  user?: UserInstance;
}

export type MessageReactionCreationAttributes = Optional<
  MessageReactions,
  'id' | 'createdAt'
>;

export interface MessageReactionInstance
  extends Model<MessageReactions, MessageReactionCreationAttributes>, MessageReactions {}

export interface ReactionSummary {
  emoji: string;
  userIds: string[];
}

export interface MessageWithReactions {
  id: string;
  channelId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM' | 'FILE';
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  fileName: string | null;
  fileUrl: string | null;
  cloudinaryPublicId: string | null;
  fileType: string | null;
  fileSize: number | null;
  sender?: { id: string; name: string; avatarUrl: string | null } | null;
  reactions: ReactionSummary[];
}
