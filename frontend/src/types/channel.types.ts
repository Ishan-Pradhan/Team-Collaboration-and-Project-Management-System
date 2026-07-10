export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM';

export interface Channel {
  id: string;
  organizationId: string;
  name: string | null;
  type: ChannelType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dmParticipant?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  joinedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export type MessageType = 'TEXT' | 'SYSTEM' | 'FILE';

export interface ReactionSummary {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string | null;
  type: MessageType;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  fileName: string | null;
  fileUrl: string | null;
  cloudinaryPublicId: string | null;
  fileType: string | null;
  fileSize: number | null;
  replyToId: string | null;
  reactions: ReactionSummary[];
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  replyTo?: {
    id: string;
    content: string;
    deletedAt: string | null;
    sender: { id: string; name: string } | null;
  } | null;
}

export interface ChannelsResponse {
  success: boolean;
  message: string;
  data: Channel[];
}

export interface ChannelResponse {
  success: boolean;
  message: string;
  data: Channel;
}

export interface ChannelMembersResponse {
  success: boolean;
  message: string;
  data: ChannelMember[];
}

export interface MessagesResponse {
  success: boolean;
  message: string;
  data: Message[];
}

export interface MutedChannelsResponse {
  success: boolean;
  message: string;
  data: string[];
}

export interface MuteChannelResponse {
  success: boolean;
  message: string;
  data: { isMuted: boolean };
}
