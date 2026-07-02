import { Op } from 'sequelize';
import { Channel, ChannelMember, User } from '../models/index.js';
import type {
  ChannelCreationAttributes,
  ChannelInstance,
  ChannelMemberInstance,
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
};
