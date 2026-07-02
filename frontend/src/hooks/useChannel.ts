import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getChannels,
  createChannel,
  deleteChannel,
  getChannelMembers,
  inviteChannelMember,
  leaveChannel,
  removeChannelMember,
  getMessages,
  sendMessage,
  addReaction,
  removeReaction,
  deleteMessage,
  getFiles,
  uploadFile,
  getDMs,
  startDM,
} from '@/services/channel.service';

export const useChannels = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'channels'],
    queryFn: () => getChannels(organizationId),
    enabled: !!organizationId,
  });

export const useCreateChannel = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: 'PUBLIC' | 'PRIVATE' }) => createChannel(organizationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] }),
  });
};

export const useDeleteChannel = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => deleteChannel(channelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] }),
  });
};

export const useChannelMembers = (channelId: string) =>
  useQuery({
    queryKey: ['channels', channelId, 'members'],
    queryFn: () => getChannelMembers(channelId),
    enabled: !!channelId,
  });

export const useInviteChannelMember = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => inviteChannelMember(channelId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] }),
  });
};

export const useLeaveChannel = (organizationId: string, channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => leaveChannel(channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] });
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    },
  });
};

export const useRemoveChannelMember = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeChannelMember(channelId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] }),
  });
};

export const useChannelMessages = (channelId: string) =>
  useQuery({
    queryKey: ['channels', channelId, 'messages'],
    queryFn: () => getMessages(channelId),
    enabled: !!channelId,
  });

export const useSendMessage = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => sendMessage(channelId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] }),
  });
};

export const useAddReaction = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      addReaction(channelId, messageId, emoji),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] }),
  });
};

export const useRemoveReaction = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      removeReaction(channelId, messageId, emoji),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] }),
  });
};

export const useDeleteMessage = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => deleteMessage(channelId, messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] }),
  });
};

export const useChannelFiles = (channelId: string) =>
  useQuery({
    queryKey: ['channels', channelId, 'files'],
    queryFn: () => getFiles(channelId),
    enabled: !!channelId,
  });

export const useUploadFile = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(channelId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] });
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'files'] });
    },
  });
};

export const useDMs = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'dms'],
    queryFn: () => getDMs(organizationId),
    enabled: !!organizationId,
  });

export const useStartDM = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => startDM(organizationId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'dms'] }),
  });
};
