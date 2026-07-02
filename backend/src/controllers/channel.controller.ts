import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { channelRepository, channelMemberRepository } from '../repositories/channel.repository.js';
import { organizationMemberRepository } from '../repositories/organization.repository.js';
import { getIO } from '../socket/index.js';

export const createChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const { name, type } = req.body as { name: string; type: 'PUBLIC' | 'PRIVATE' };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

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

  const channels = await channelRepository.findVisibleToUser(organizationId, user.id);
  return ok(res, channels, 'Channels retrieved successfully');
});

export const deleteChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  await channelRepository.delete(channelId);

  getIO().to(`org:${channel.organizationId}`).emit('channel:deleted', { id: channelId });

  return ok(res, null, 'Channel deleted successfully');
});
