import { Op } from 'sequelize';
import {
  Organization,
  OrganizationMember,
  Invitation,
  User,
} from '../models/index.js';
import type {
  OrganizationCreationAttributes,
  OrganizationInstance,
  OrganizationMemberCreationAttributes,
  OrganizationMemberInstance,
  OrganizationInviteCreationAttributes,
  OrganizationInviteInstance,
} from '../types/organizations.types.js';

export const organizationRepository = {
  create: async (data: OrganizationCreationAttributes): Promise<OrganizationInstance> => {
    return await Organization.create(data);
  },

  findById: async (id: string): Promise<OrganizationInstance | null> => {
    return await Organization.findByPk(id);
  },

  findAllWithOwner: async (): Promise<OrganizationInstance[]> => {
    return await Organization.findAll({
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });
  },
};

export const organizationMemberRepository = {
  create: async (data: OrganizationMemberCreationAttributes): Promise<OrganizationMemberInstance> => {
    return await OrganizationMember.create(data);
  },

  findOrCreate: async (
    organizationId: string,
    userId: string,
    defaults: { role: 'ORG_ADMIN' | 'MEMBER' }
  ): Promise<[OrganizationMemberInstance, boolean]> => {
    return await OrganizationMember.findOrCreate({
      where: { organizationId, userId },
      defaults: {
        organizationId,
        userId,
        role: defaults.role,
      },
    });
  },

  findOne: async (options: {
    organizationId: string;
    userId: string;
  }): Promise<OrganizationMemberInstance | null> => {
    return await OrganizationMember.findOne({
      where: {
        organizationId: options.organizationId,
        userId: options.userId,
      },
    });
  },

  findAllByUserId: async (userId: string): Promise<OrganizationMemberInstance[]> => {
    return await OrganizationMember.findAll({
      where: { userId },
      include: [
        {
          model: Organization,
          as: 'organization',
        },
      ],
    });
  },

  findAllMembersInOrg: async (organizationId: string): Promise<OrganizationMemberInstance[]> => {
    return await OrganizationMember.findAll({
      where: { organizationId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'avatarUrl'],
        },
      ],
    });
  },
};

export const organizationInviteRepository = {
  create: async (data: OrganizationInviteCreationAttributes): Promise<OrganizationInviteInstance> => {
    return await Invitation.create(data);
  },

  findOnePending: async (organizationId: string, email: string): Promise<OrganizationInviteInstance | null> => {
    return await Invitation.findOne({
      where: {
        organizationId,
        email,
        status: 'PENDING',
        expiresAt: { [Op.gt]: new Date() },
      },
    });
  },

  findOneByToken: async (token: string): Promise<OrganizationInviteInstance | null> => {
    return await Invitation.findOne({
      where: { token, status: 'PENDING' },
    });
  },
};

