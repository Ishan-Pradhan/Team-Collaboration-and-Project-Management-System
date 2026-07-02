import { Op } from 'sequelize';
import { Channel, ChannelMember, Message, User } from '../models/index.js';
import type {
  ChannelCreationAttributes,
  ChannelInstance,
  ChannelMemberInstance,
  MessageCreationAttributes,
  MessageInstance,
} from '../types/channels.types.js';

export const channelRepository = {
  create: async (data: ChannelCreationAttributes): Promise<ChannelInstance> => {
    return await Channel.create(data);
  },

  findById: async (id: string): Promise<ChannelInstance | null> => {
    return await Channel.findByPk(id);
  },

  findByOrgAndName: async (organizationId: string, name: string): Promise<ChannelInstance | null> => {
    return await Channel.findOne({ where: { organizationId, name } });
  },

  findVisibleToUser: async (organizationId: string, userId: string): Promise<ChannelInstance[]> => {
    const memberships = await ChannelMember.findAll({
      where: { userId },
      attributes: ['channelId'],
    });
    const memberChannelIds = memberships.map((m) => m.channelId);

    return await Channel.findAll({
      where: {
        organizationId,
        [Op.or]: [{ type: 'PUBLIC' }, { id: { [Op.in]: memberChannelIds } }],
      },
      order: [['createdAt', 'ASC']],
    });
  },

  delete: async (id: string): Promise<boolean> => {
    const channel = await Channel.findByPk(id);
    if (!channel) return false;
    await channel.destroy();
    return true;
  },
};

export const channelMemberRepository = {
  addMembers: async (channelId: string, userIds: string[]): Promise<void> => {
    if (userIds.length === 0) return;
    await ChannelMember.bulkCreate(
      userIds.map((userId) => ({ channelId, userId })),
      { ignoreDuplicates: true },
    );
  },

  findMember: async (channelId: string, userId: string): Promise<ChannelMemberInstance | null> => {
    return await ChannelMember.findOne({ where: { channelId, userId } });
  },

  findMembers: async (channelId: string): Promise<ChannelMemberInstance[]> => {
    return await ChannelMember.findAll({
      where: { channelId },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatarUrl'] }],
      order: [['joinedAt', 'ASC']],
    });
  },

  removeMember: async (channelId: string, userId: string): Promise<number> => {
    return await ChannelMember.destroy({ where: { channelId, userId } });
  },

  findChannelIdsForUserInOrg: async (organizationId: string, userId: string): Promise<string[]> => {
    const channels = await Channel.findAll({ where: { organizationId }, attributes: ['id'] });
    const orgChannelIds = channels.map((c) => c.id);
    if (orgChannelIds.length === 0) return [];
    const memberships = await ChannelMember.findAll({
      where: { userId, channelId: { [Op.in]: orgChannelIds } },
      attributes: ['channelId'],
    });
    return memberships.map((m) => m.channelId);
  },

  addUserToAllPublicChannels: async (organizationId: string, userId: string): Promise<string[]> => {
    const publicChannels = await Channel.findAll({
      where: { organizationId, type: 'PUBLIC' },
      attributes: ['id'],
    });
    if (publicChannels.length === 0) return [];
    await ChannelMember.bulkCreate(
      publicChannels.map((c) => ({ channelId: c.id, userId })),
      { ignoreDuplicates: true },
    );
    return publicChannels.map((c) => c.id);
  },
};

export const messageRepository = {
  create: async (data: MessageCreationAttributes): Promise<MessageInstance> => {
    return await Message.create(data);
  },

  findById: async (id: string): Promise<MessageInstance | null> => {
    return await Message.findByPk(id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] }],
    });
  },

  findByChannel: async (
    channelId: string,
    options: { before?: string; limit: number },
  ): Promise<MessageInstance[]> => {
    const where: Record<string, unknown> = { channelId };
    if (options.before) {
      where.createdAt = { [Op.lt]: options.before };
    }
    const messages = await Message.findAll({
      where,
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] }],
      order: [['createdAt', 'DESC']],
      limit: options.limit,
    });
    return messages.reverse();
  },
};
