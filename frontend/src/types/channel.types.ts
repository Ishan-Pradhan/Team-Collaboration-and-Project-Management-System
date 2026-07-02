export type ChannelType = 'PUBLIC' | 'PRIVATE';

export interface Channel {
  id: string;
  organizationId: string;
  name: string;
  type: ChannelType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export type MessageType = 'TEXT' | 'SYSTEM';

export interface Message {
  id: string;
  channelId: string;
  senderId: string | null;
  type: MessageType;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
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
