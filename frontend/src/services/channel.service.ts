import { api } from '@/lib/axios';
import type {
  Channel,
  ChannelMember,
  ChannelsResponse,
  ChannelResponse,
  ChannelMembersResponse,
  Message,
  MessagesResponse,
} from '@/types/channel.types';

export async function getChannels(organizationId: string): Promise<Channel[]> {
  const res = await api.get<ChannelsResponse>(`/organizations/${organizationId}/channels`);
  return res.data.data;
}

export async function createChannel(
  organizationId: string,
  data: { name: string; type: 'PUBLIC' | 'PRIVATE' },
): Promise<Channel> {
  const res = await api.post<ChannelResponse>(`/organizations/${organizationId}/channels`, data);
  return res.data.data;
}

export async function deleteChannel(channelId: string): Promise<void> {
  await api.delete(`/channels/${channelId}`);
}

export async function getChannelMembers(channelId: string): Promise<ChannelMember[]> {
  const res = await api.get<ChannelMembersResponse>(`/channels/${channelId}/members`);
  return res.data.data;
}

export async function inviteChannelMember(channelId: string, userId: string): Promise<void> {
  await api.post(`/channels/${channelId}/members`, { userId });
}

export async function leaveChannel(channelId: string): Promise<void> {
  await api.delete(`/channels/${channelId}/members/me`);
}

export async function removeChannelMember(channelId: string, userId: string): Promise<void> {
  await api.delete(`/channels/${channelId}/members/${userId}`);
}

export async function getMessages(channelId: string, before?: string): Promise<Message[]> {
  const res = await api.get<MessagesResponse>(`/channels/${channelId}/messages`, {
    params: before ? { before } : undefined,
  });
  return res.data.data;
}

export async function sendMessage(channelId: string, content: string): Promise<Message> {
  const res = await api.post<{ success: boolean; message: string; data: Message }>(
    `/channels/${channelId}/messages`,
    { content },
  );
  return res.data.data;
}
