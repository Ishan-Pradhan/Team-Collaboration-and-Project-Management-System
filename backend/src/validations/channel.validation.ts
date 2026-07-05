import { z } from 'zod';

export const createChannelSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    name: z.string().min(1, 'Channel name is required').max(100, 'Name must be 100 characters or less'),
    type: z.enum(['PUBLIC', 'PRIVATE']),
  }),
};

export const organizationChannelsParamSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
};

export const channelParamSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
};

export const muteChannelSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
  body: z.object({
    isMuted: z.boolean(),
  }),
};

export const inviteChannelMemberSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
};

export const channelMemberParamSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
    userId: z.string().uuid('Invalid user ID'),
  }),
};

export const sendMessageSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
  body: z.object({
    content: z.string().min(1, 'Message content is required').max(4000, 'Message must be 4000 characters or less'),
  }),
};

export const listMessagesSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
  query: z.object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
};

export const messageParamSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
    messageId: z.string().uuid('Invalid message ID'),
  }),
};

export const addReactionSchema = {
  params: messageParamSchema.params,
  body: z.object({
    emoji: z.string().min(1, 'Emoji is required').max(64, 'Invalid emoji'),
  }),
};

export const removeReactionSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
    messageId: z.string().uuid('Invalid message ID'),
    emoji: z.string().min(1, 'Emoji is required').max(64, 'Invalid emoji'),
  }),
};

export const startDMSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
};
