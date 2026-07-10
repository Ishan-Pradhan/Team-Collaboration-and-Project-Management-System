import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { channelRepository, channelMemberRepository, messageRepository, messageReactionRepository } from '../repositories/channel.repository.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary.service.js';

function cloudinaryResourceType(mimeType: string): 'image' | 'video' | 'raw' {
  if (mimeType.startsWith('image/') || mimeType === 'application/pdf') return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}
import { organizationMemberRepository } from '../repositories/organization.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { organizationRepository } from '../repositories/organization.repository.js';
import { getIO } from '../socket/index.js';
import { notifyUser, notifyNewMessage } from '../utils/notify.js';
import { env } from '../config/env.js';
import type { ChannelInstance } from '../types/channels.types.js';
import { extractMentionedUserIds, stripMentionTokens } from '../utils/mentions.js';

export const createChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const { name, type } = req.body as { name: string; type: 'PUBLIC' | 'PRIVATE' };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.chatEnabled) throw new ApiError(403, 'Chat has been disabled for this organization');

  const existing = await channelRepository.findByOrgAndName(organizationId, name.trim());
  if (existing) {
    throw new ApiError(409, 'A channel with this name already exists in this organization');
  }

  const channel = await channelRepository.create({
    organizationId,
    name: name.trim(),
    type,
    createdBy: user.id,
  });

  if (type === 'PUBLIC') {
    const orgMembers = await organizationMemberRepository.findAllMembersInOrg(organizationId);
    const memberIds = new Set(orgMembers.map((m) => m.userId));
    memberIds.add(user.id);
    await channelMemberRepository.addMembers(channel.id, [...memberIds]);
  } else {
    await channelMemberRepository.addMembers(channel.id, [user.id]);
  }

  getIO().to(`org:${organizationId}`).emit('channel:created', channel);

  return res.status(201).json({
    success: true,
    message: 'Channel created successfully',
    data: channel,
  });
});

export const listChannels = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.chatEnabled) throw new ApiError(403, 'Chat has been disabled for this organization');

  const channels = await channelRepository.findVisibleToUser(organizationId, user.id);
  return ok(res, channels, 'Channels retrieved successfully');
});

export const deleteChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  await channelRepository.delete(channelId);

  getIO().to(`org:${channel.organizationId}`).emit('channel:deleted', { id: channelId });

  return ok(res, null, 'Channel deleted successfully');
});

export const updateChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { name } = req.body as { name: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  // Auth: Creator or Org Admin
  const isCreator = channel.createdBy === user.id;
  let isOrgAdmin = false;

  const org = await organizationRepository.findById(channel.organizationId);
  if (org?.ownerId === user.id) {
    isOrgAdmin = true;
  } else {
    const membership = await organizationMemberRepository.findOne({
      organizationId: channel.organizationId,
      userId: user.id,
    });
    isOrgAdmin = membership?.role === 'ORG_ADMIN';
  }

  if (!isCreator && !isOrgAdmin) {
    throw new ApiError(403, 'Unauthorized. Only the channel creator or organization admins can rename this channel.');
  }

  const trimmedName = name.trim();
  if (trimmedName.toLowerCase() !== channel.name?.toLowerCase()) {
    const existing = await channelRepository.findByOrgAndName(channel.organizationId, trimmedName);
    if (existing) {
      throw new ApiError(409, 'A channel with this name already exists in this organization');
    }
  }

  const updatedChannel = await channelRepository.update(channelId, { name: trimmedName });

  getIO().to(`org:${channel.organizationId}`).emit('channel:updated', updatedChannel);

  return ok(res, updatedChannel, 'Channel renamed successfully');
});

export async function removeMemberAndNotify(
  channel: ChannelInstance,
  userId: string,
  displayName: string,
  reason: 'left' | 'removed',
  removedByName?: string,
): Promise<void> {
  const channelId = channel.id;
  await channelMemberRepository.removeMember(channelId, userId);

  const message = await messageRepository.create({
    channelId,
    senderId: null,
    type: 'SYSTEM',
    content: reason === 'left' ? `${displayName} left the channel` : `${displayName} was removed from the channel`,
  });

  const io = getIO();
  io.to(`channel:${channelId}`).emit('member:left', { channelId, userId });
  io.to(`channel:${channelId}`).emit('message:new', message);
  io.in(`user:${userId}`).socketsLeave(`channel:${channelId}`);

  // Only notify when someone else removed this user — a voluntary "left" needs no self-notification.
  if (reason === 'removed') {
    const [org, targetUser] = await Promise.all([
      organizationRepository.findById(channel.organizationId),
      userRepository.findById(userId),
    ]);

    const remover = removedByName ?? 'An admin';
    await notifyUser({
      userId,
      organizationId: channel.organizationId,
      type: 'channel_member_removed',
      title: `You were removed from #${channel.name}`,
      body: `${remover} removed you from the ${channel.name} channel in ${org?.name ?? 'your workspace'}.`,
      entityType: 'channel',
      entityId: channelId,
      email: targetUser
        ? {
            to: targetUser.email,
            subject: `You were removed from #${channel.name}`,
            bodyText: `${remover} removed you from the ${channel.name} channel in ${org?.name ?? 'your workspace'}.`,
            link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/chat`,
          }
        : undefined,
    });
  }
}

export const listChannelMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const members = await channelMemberRepository.findMembers(channelId);
  return ok(res, members, 'Channel members retrieved successfully');
});

export const inviteChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { userId } = req.body as { userId: string };
  const actor = req.user;
  if (!actor) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  const org = await organizationRepository.findById(channel.organizationId);
  const targetMembership = await organizationMemberRepository.findOne({
    organizationId: channel.organizationId,
    userId,
  });
  if (!targetMembership && org?.ownerId !== userId) {
    throw new ApiError(400, 'User is not a member of this organization');
  }

  const alreadyMember = await channelMemberRepository.findMember(channelId, userId);
  if (alreadyMember) {
    throw new ApiError(400, 'User is already a member of this channel');
  }

  await channelMemberRepository.addMembers(channelId, [userId]);

  const invitedUser = await userRepository.findById(userId);
  const message = await messageRepository.create({
    channelId,
    senderId: null,
    type: 'SYSTEM',
    content: `${invitedUser?.name ?? 'A member'} joined the channel`,
  });

  const io = getIO();
  io.in(`user:${userId}`).socketsJoin(`channel:${channelId}`);
  io.to(`channel:${channelId}`).emit('member:joined', { channelId, userId });
  io.to(`channel:${channelId}`).emit('message:new', message);

  await notifyUser({
    userId,
    organizationId: channel.organizationId,
    type: 'channel_member_added',
    title: `${actor.name} added you to #${channel.name}`,
    body: `You were added to the ${channel.name} channel in ${org?.name ?? 'your workspace'}.`,
    entityType: 'channel',
    entityId: channelId,
    email: invitedUser
      ? {
          to: invitedUser.email,
          subject: `${actor.name} added you to #${channel.name}`,
          bodyText: `You were added to the ${channel.name} channel in ${org?.name ?? 'your workspace'}.`,
          link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/chat?channelId=${channelId}`,
        }
      : undefined,
  });

  return res.status(201).json({
    success: true,
    message: 'Member added to channel',
    data: null,
  });
});

export const leaveChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  const membership = await channelMemberRepository.findMember(channelId, user.id);
  if (!membership) throw new ApiError(404, 'You are not a member of this channel');

  await removeMemberAndNotify(channel, user.id, user.name, 'left');
  return ok(res, null, 'You have left the channel');
});

export const removeChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const userId = req.params.userId as string;
  const actor = req.user;
  if (!actor) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  const membership = await channelMemberRepository.findMember(channelId, userId);
  if (!membership) throw new ApiError(404, 'Member not found in this channel');

  const targetUser = await userRepository.findById(userId);
  await removeMemberAndNotify(channel, userId, targetUser?.name ?? 'A member', 'removed', actor.name);
  return ok(res, null, 'Member removed successfully');
});

export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { content, replyToId } = req.body as { content: string; replyToId?: string | null };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  if (replyToId) {
    const replyTarget = await messageRepository.findById(replyToId);
    if (!replyTarget || replyTarget.channelId !== channelId) {
      throw new ApiError(400, 'The message being replied to was not found in this channel');
    }
  }

  const trimmedContent = content.trim();
  const created = await messageRepository.create({
    channelId,
    senderId: user.id,
    type: 'TEXT',
    content: trimmedContent,
    replyToId: replyToId || null,
  });
  const message = await messageRepository.findById(created.id);

  getIO().to(`channel:${channelId}`).emit('message:new', message);

  const members = await channelMemberRepository.findMembers(channelId);
  const previewText = stripMentionTokens(trimmedContent).slice(0, 200);

  // Drives the chat sidebar's per-channel unread dots only — excluded from
  // the notification bell (see notification.repository.ts).
  const title = channel.type === 'DM'
    ? `${user.name} sent you a message`
    : `${user.name} sent a message in #${channel.name}`;
  await Promise.all(
    members
      .filter((m) => m.userId !== user.id)
      .map((m) =>
        notifyNewMessage({
          userId: m.userId,
          organizationId: channel.organizationId,
          channelId,
          title,
          body: `${user.name}: ${previewText}`,
        })
      )
  );

  const mentionedUserIds = extractMentionedUserIds(
    trimmedContent,
    members.map((m) => m.userId),
  ).filter((id) => id !== user.id);

  if (mentionedUserIds.length > 0) {
    const org = await organizationRepository.findById(channel.organizationId);
    const mentionTitle = channel.type === 'DM'
      ? `${user.name} mentioned you`
      : `${user.name} mentioned you in #${channel.name}`;
    const link = `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/chat?channelId=${channelId}`;
    await Promise.all(
      mentionedUserIds.map(async (mentionedUserId) => {
        const targetUser = await userRepository.findById(mentionedUserId);
        await notifyUser({
          userId: mentionedUserId,
          organizationId: channel.organizationId,
          type: 'mention',
          title: mentionTitle,
          body: previewText,
          entityType: 'channel',
          entityId: channelId,
          email: targetUser
            ? {
                to: targetUser.email,
                subject: mentionTitle,
                bodyText: previewText,
                link,
              }
            : undefined,
        });
      })
    );
  }

  return res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: message,
  });
});

export const listMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { before, limit } = req.query as { before?: string; limit?: string };

  const messages = await messageRepository.findByChannel(channelId, {
    before,
    limit: limit ? Number(limit) : 50,
  });

  return ok(res, messages, 'Messages retrieved successfully');
});

export const addReaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;
  const { emoji } = req.body as { emoji: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const message = await messageRepository.findById(messageId);
  if (!message || message.channelId !== channelId) throw new ApiError(404, 'Message not found');
  if (message.type === 'SYSTEM') throw new ApiError(400, 'Cannot react to a system message');
  if (message.deletedAt) throw new ApiError(400, 'Cannot react to a deleted message');

  await messageReactionRepository.add(messageId, user.id, emoji);

  getIO().to(`channel:${channelId}`).emit('reaction:added', { messageId, channelId, emoji, userId: user.id });

  return res.status(201).json({
    success: true,
    message: 'Reaction added',
    data: null,
  });
});

export const removeReaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;
  const emoji = req.params.emoji as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const message = await messageRepository.findById(messageId);
  if (!message || message.channelId !== channelId) throw new ApiError(404, 'Message not found');

  const removed = await messageReactionRepository.remove(messageId, user.id, emoji);
  if (removed === 0) throw new ApiError(404, 'Reaction not found');

  getIO().to(`channel:${channelId}`).emit('reaction:removed', { messageId, channelId, emoji, userId: user.id });

  return ok(res, null, 'Reaction removed');
});

export const deleteMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const message = await messageRepository.findById(messageId);
  if (!message || message.channelId !== channelId) throw new ApiError(404, 'Message not found');
  if (message.type === 'SYSTEM') throw new ApiError(400, 'Cannot delete a system message');
  if (message.deletedAt) throw new ApiError(400, 'Message already deleted');

  const isSender = message.senderId === user.id;
  let isAdmin = false;
  if (!isSender) {
    const channel = await channelRepository.findById(channelId);
    if (channel && channel.type !== 'DM') {
      const org = await organizationRepository.findById(channel.organizationId);
      if (org?.ownerId === user.id) {
        isAdmin = true;
      } else {
        const membership = await organizationMemberRepository.findOne({
          organizationId: channel.organizationId,
          userId: user.id,
        });
        isAdmin = membership?.role === 'ORG_ADMIN';
      }
    }
  }
  if (!isSender && !isAdmin) {
    throw new ApiError(403, 'Unauthorized request. Only the sender or an organization admin can delete this message.');
  }

  if (message.type === 'FILE' && message.cloudinaryPublicId && message.fileType) {
    await deleteFromCloudinary(message.cloudinaryPublicId, cloudinaryResourceType(message.fileType));
  }

  await messageRepository.delete(messageId, user.id);

  getIO().to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });

  return ok(res, null, 'Message deleted successfully');
});

export const uploadFile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const file = req.file;
  if (!file) throw new ApiError(400, 'No file uploaded');

  const uploaded = await uploadToCloudinary(file.buffer, {
    folder: `chat-files/${channelId}`,
    resourceType: 'auto',
  });

  const created = await messageRepository.create({
    channelId,
    senderId: user.id,
    type: 'FILE',
    content: '',
    fileName: file.originalname,
    fileUrl: uploaded.url,
    cloudinaryPublicId: uploaded.publicId,
    fileType: file.mimetype,
    fileSize: file.size,
  });
  const message = await messageRepository.findById(created.id);

  getIO().to(`channel:${channelId}`).emit('message:new', message);

  const members = await channelMemberRepository.findMembers(channelId);
  const title = channel.type === 'DM'
    ? `${user.name} sent you a message`
    : `${user.name} sent a message in #${channel.name}`;
  await Promise.all(
    members
      .filter((m) => m.userId !== user.id)
      .map((m) =>
        notifyNewMessage({
          userId: m.userId,
          organizationId: channel.organizationId,
          channelId,
          title,
          body: `${user.name}: Sent a file: ${file.originalname}`,
        })
      )
  );

  return res.status(201).json({
    success: true,
    message: 'File shared successfully',
    data: message,
  });
});

export const listFiles = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { before, limit } = req.query as { before?: string; limit?: string };

  const files = await messageRepository.findFilesByChannel(channelId, {
    before,
    limit: limit ? Number(limit) : 50,
  });

  return ok(res, files, 'Files retrieved successfully');
});

export const downloadFile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;

  const message = await messageRepository.findById(messageId);
  if (!message || message.channelId !== channelId) throw new ApiError(404, 'Message not found');
  if (message.type !== 'FILE') throw new ApiError(400, 'Message has no file attachment');
  if (message.deletedAt) throw new ApiError(400, 'File is no longer available');

  const upstream = await fetch(message.fileUrl as string);
  if (!upstream.ok) throw new ApiError(502, 'Could not retrieve file from storage');

  const safeName = encodeURIComponent(message.fileName as string);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
  res.setHeader('Content-Type', message.fileType as string);
  if (message.fileSize) res.setHeader('Content-Length', String(message.fileSize));
  res.setHeader('Cache-Control', 'private, no-store');

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.end(buffer);
});

export const startDM = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const { userId: targetUserId } = req.body as { userId: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  if (targetUserId === user.id) throw new ApiError(400, 'Cannot start a DM with yourself');

  const org = await organizationRepository.findById(organizationId);
  if (org && !org.featureFlags.chatEnabled) {
    throw new ApiError(403, 'Chat has been disabled for this organization');
  }
  const targetMembership = await organizationMemberRepository.findOne({ organizationId, userId: targetUserId });
  if (!targetMembership && org?.ownerId !== targetUserId) {
    throw new ApiError(400, 'User is not a member of this organization');
  }

  const { channel, created } = await channelRepository.findOrCreateDM(organizationId, user.id, targetUserId);

  if (created) {
    const io = getIO();
    io.in(`user:${user.id}`).socketsJoin(`channel:${channel.id}`);
    io.in(`user:${targetUserId}`).socketsJoin(`channel:${channel.id}`);
  }

  const targetUser = await userRepository.findById(targetUserId);
  const data = {
    ...channel.get({ plain: true }),
    dmParticipant: targetUser ? { id: targetUser.id, name: targetUser.name, avatarUrl: targetUser.avatarUrl } : null,
  };

  return res.status(created ? 201 : 200).json({
    success: true,
    message: created ? 'Direct message started' : 'Direct message already exists',
    data,
  });
});

export const listDMs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.chatEnabled) throw new ApiError(403, 'Chat has been disabled for this organization');

  const channels = await channelRepository.findDMsForUser(organizationId, user.id);

  const data = await Promise.all(
    channels.map(async (channel) => {
      const members = await channelMemberRepository.findMembers(channel.id);
      const other = members.find((m) => m.userId !== user.id);
      return {
        ...channel.get({ plain: true }),
        dmParticipant: other?.user
          ? { id: other.user.id, name: other.user.name, avatarUrl: other.user.avatarUrl }
          : null,
      };
    })
  );

  return ok(res, data, 'Direct messages retrieved successfully');
});

export async function cascadeRemoveUserFromOrgChannels(
  organizationId: string,
  userId: string,
  actorName: string,
): Promise<void> {
  const channelIds = await channelMemberRepository.findChannelIdsForUserInOrg(organizationId, userId);
  for (const channelId of channelIds) {
    const channel = await channelRepository.findById(channelId);
    if (!channel) continue;
    await removeMemberAndNotify(channel, userId, actorName, 'removed');
  }
}

export async function autoJoinUserToPublicChannels(
  organizationId: string,
  userId: string,
): Promise<void> {
  const channelIds = await channelMemberRepository.addUserToAllPublicChannels(organizationId, userId);
  const io = getIO();
  channelIds.forEach((channelId) => {
    io.in(`user:${userId}`).socketsJoin(`channel:${channelId}`);
  });
}

export const muteChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { isMuted } = req.body as { isMuted: boolean };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const updated = await channelMemberRepository.setMuted(channelId, user.id, isMuted);
  if (!updated) throw new ApiError(404, 'You are not a member of this channel');

  return ok(res, { isMuted: updated.isMuted }, isMuted ? 'Channel muted' : 'Channel unmuted');
});

export const listMutedChannels = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelIds = await channelMemberRepository.findMutedChannelIds(user.id);
  return ok(res, channelIds, 'Muted channels retrieved successfully');
});
