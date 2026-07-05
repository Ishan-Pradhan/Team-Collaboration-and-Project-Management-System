import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import { Channel, ChannelMember, Message, MessageReaction, User } from '../models/index.js';
import type {
  ChannelCreationAttributes,
  ChannelInstance,
  ChannelMemberInstance,
  MessageCreationAttributes,
  MessageInstance,
  MessageWithReactions,
  ReactionSummary,
} from '../types/channels.types.js';

function groupReactions(rows: { emoji: string; userId: string }[]): ReactionSummary[] {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.emoji);
    if (existing) {
      existing.push(row.userId);
    } else {
      map.set(row.emoji, [row.userId]);
    }
  }
  return Array.from(map.entries()).map(([emoji, userIds]) => ({ emoji, userIds }));
}

function buildDmKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}

export const channelRepository = {
  create: async (data: ChannelCreationAttributes): Promise<ChannelInstance> => {
    return await Channel.create(data);
  },

  findById: async (id: string): Promise<ChannelInstance | null> => {
    return await Channel.findByPk(id);
  },

  update: async (id: string, data: { name: string }): Promise<ChannelInstance | null> => {
    const channel = await Channel.findByPk(id);
    if (!channel) return null;
    return await channel.update(data);
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
        type: { [Op.ne]: 'DM' },
        [Op.or]: [{ type: 'PUBLIC' }, { id: { [Op.in]: memberChannelIds } }],
      },
      order: [
        // PUBLIC (0) before PRIVATE (1), then alphabetically within each group
        [sequelize.literal(`CASE WHEN type = 'PUBLIC' THEN 0 ELSE 1 END`), 'ASC'],
        ['name', 'ASC'],
      ],
    });
  },

  delete: async (id: string): Promise<boolean> => {
    const channel = await Channel.findByPk(id);
    if (!channel) return false;
    await channel.destroy();
    return true;
  },

  findOrCreateDM: async (
    organizationId: string,
    userIdA: string,
    userIdB: string,
  ): Promise<{ channel: ChannelInstance; created: boolean }> => {
    const dmKey = buildDmKey(userIdA, userIdB);
    const existing = await Channel.findOne({ where: { organizationId, dmKey } });
    if (existing) return { channel: existing, created: false };

    const channel = await Channel.create({
      organizationId,
      name: null,
      type: 'DM',
      createdBy: userIdA,
      dmKey,
    });
    await ChannelMember.bulkCreate([
      { channelId: channel.id, userId: userIdA },
      { channelId: channel.id, userId: userIdB },
    ]);
    return { channel, created: true };
  },

  findDMsForUser: async (organizationId: string, userId: string): Promise<ChannelInstance[]> => {
    const memberships = await ChannelMember.findAll({
      where: { userId },
      attributes: ['channelId'],
    });
    const memberChannelIds = memberships.map((m) => m.channelId);
    if (memberChannelIds.length === 0) return [];
    return await Channel.findAll({
      where: {
        organizationId,
        type: 'DM',
        id: { [Op.in]: memberChannelIds },
      },
      order: [['createdAt', 'DESC']],
    });
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

  setMuted: async (
    channelId: string,
    userId: string,
    isMuted: boolean,
  ): Promise<ChannelMemberInstance | null> => {
    const membership = await ChannelMember.findOne({ where: { channelId, userId } });
    if (!membership) return null;
    return await membership.update({ isMuted });
  },

  findMutedChannelIds: async (userId: string): Promise<string[]> => {
    const memberships = await ChannelMember.findAll({
      where: { userId, isMuted: true },
      attributes: ['channelId'],
    });
    return memberships.map((m) => m.channelId);
  },
};

export const messageRepository = {
  create: async (data: MessageCreationAttributes): Promise<MessageInstance> => {
    return await Message.create(data);
  },

  findById: async (id: string): Promise<MessageWithReactions | null> => {
    const message = await Message.findByPk(id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] },
        { model: MessageReaction, as: 'reactions', attributes: ['emoji', 'userId'] },
      ],
    });
    if (!message) return null;
    const plain = message.get({ plain: true }) as MessageWithReactions & {
      reactions: { emoji: string; userId: string }[];
    };
    return { ...plain, reactions: groupReactions(plain.reactions) };
  },

  findByChannel: async (
    channelId: string,
    options: { before?: string; limit: number },
  ): Promise<MessageWithReactions[]> => {
    const where: Record<string, unknown> = { channelId };
    if (options.before) {
      where.createdAt = { [Op.lt]: options.before };
    }
    const messages = await Message.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] },
        { model: MessageReaction, as: 'reactions', attributes: ['emoji', 'userId'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: options.limit,
    });
    const plain = messages.map(
      (m) =>
        m.get({ plain: true }) as MessageWithReactions & {
          reactions: { emoji: string; userId: string }[];
        },
    );
    return plain.reverse().map((m) => ({ ...m, reactions: groupReactions(m.reactions) }));
  },

  delete: async (id: string, deletedBy: string): Promise<void> => {
    await Message.update(
      { content: '', deletedAt: new Date(), deletedBy },
      { where: { id } },
    );
    await MessageReaction.destroy({ where: { messageId: id } });
  },

  findFilesByChannel: async (
    channelId: string,
    options: { before?: string; limit: number },
  ): Promise<MessageWithReactions[]> => {
    const where: Record<string, unknown> = { channelId, type: 'FILE', deletedAt: null };
    if (options.before) {
      where.createdAt = { [Op.lt]: options.before };
    }
    const messages = await Message.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] },
        { model: MessageReaction, as: 'reactions', attributes: ['emoji', 'userId'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: options.limit,
    });
    return messages.map((m) => {
      const plain = m.get({ plain: true }) as MessageWithReactions & {
        reactions: { emoji: string; userId: string }[];
      };
      return { ...plain, reactions: groupReactions(plain.reactions) };
    });
  },
};

export const messageReactionRepository = {
  add: async (messageId: string, userId: string, emoji: string): Promise<void> => {
    await MessageReaction.findOrCreate({ where: { messageId, userId, emoji } });
  },

  remove: async (messageId: string, userId: string, emoji: string): Promise<number> => {
    return await MessageReaction.destroy({ where: { messageId, userId, emoji } });
  },
};
