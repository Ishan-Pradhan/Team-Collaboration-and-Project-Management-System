import { Op, fn, col } from 'sequelize';
import {
  Organization,
  OrganizationMember,
  Invitation,
  OrganizationBan,
  User,
  Project,
  ProjectMember,
  Task,
  KanbanColumn,
  ActivityLog,
} from '../models/index.js';
import type {
  OrganizationCreationAttributes,
  OrganizationInstance,
  OrganizationMemberCreationAttributes,
  OrganizationMemberInstance,
  OrganizationInviteCreationAttributes,
  OrganizationInviteInstance,
  OrganizationBanInstance,
} from '../types/organizations.types.js';

export const organizationRepository = {
  create: async (data: OrganizationCreationAttributes): Promise<OrganizationInstance> => {
    return await Organization.create(data);
  },

  findById: async (id: string): Promise<OrganizationInstance | null> => {
    return await Organization.findByPk(id);
  },

  findBySlug: async (slug: string): Promise<OrganizationInstance | null> => {
    return await Organization.findOne({ where: { slug } });
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

  update: async (
    id: string,
    data: Partial<OrganizationCreationAttributes>
  ): Promise<OrganizationInstance | null> => {
    const org = await Organization.findByPk(id);
    if (!org) return null;
    return await org.update(data);
  },

  suspend: async (id: string): Promise<OrganizationInstance | null> => {
    const org = await Organization.findByPk(id);
    if (!org) return null;
    return await org.update({ isSuspended: true });
  },

  unsuspend: async (id: string): Promise<OrganizationInstance | null> => {
    const org = await Organization.findByPk(id);
    if (!org) return null;
    return await org.update({ isSuspended: false });
  },

  delete: async (id: string): Promise<boolean> => {
    const org = await Organization.findByPk(id);
    if (!org) return false;
    await org.destroy();
    return true;
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

  updateRole: async (
    organizationId: string,
    userId: string,
    role: 'ORG_ADMIN' | 'MEMBER'
  ): Promise<OrganizationMemberInstance | null> => {
    const member = await OrganizationMember.findOne({ where: { organizationId, userId } });
    if (!member) return null;
    return await member.update({ role });
  },

  findAdminIds: async (organizationId: string, ownerId: string): Promise<string[]> => {
    const admins = await OrganizationMember.findAll({
      where: { organizationId, role: 'ORG_ADMIN' },
      attributes: ['userId'],
    });
    const ids = new Set([ownerId, ...admins.map((m) => m.userId)]);
    return [...ids];
  },

  setMuted: async (
    organizationId: string,
    userId: string,
    isMuted: boolean,
  ): Promise<OrganizationMemberInstance | null> => {
    const membership = await OrganizationMember.findOne({ where: { organizationId, userId } });
    if (!membership) return null;
    return await membership.update({ isMuted });
  },

  findMutedOrganizationIds: async (userId: string): Promise<string[]> => {
    const memberships = await OrganizationMember.findAll({
      where: { userId, isMuted: true },
      attributes: ['organizationId'],
    });
    return memberships.map((m) => m.organizationId);
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

  findPendingByOrg: async (organizationId: string): Promise<OrganizationInviteInstance[]> => {
    return await Invitation.findAll({
      where: {
        organizationId,
        status: 'PENDING',
        expiresAt: { [Op.gt]: new Date() },
      },
      include: [
        {
          model: User,
          as: 'invitedBy',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  },

  deleteById: async (id: string, organizationId: string): Promise<number> => {
    return await Invitation.destroy({ where: { id, organizationId, status: 'PENDING' } });
  },
};

export const dashboardRepository = {
  getDashboardData: async (orgId: string, userId: string) => {
    // Step 1: user's active project memberships in this org
    const myMemberships = await ProjectMember.findAll({
      where: { userId },
      include: [{
        model: Project,
        as: 'project',
        where: { organizationId: orgId, status: 'ACTIVE' },
        required: true,
        attributes: ['id', 'name', 'description'],
      }],
      attributes: ['projectId', 'role'],
    });

    const myProjectIds = myMemberships.map((m) => (m as any).projectId as string);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    const assigneeInclude = {
      model: User,
      as: 'assignees',
      where: { id: userId },
      required: true,
      attributes: [] as string[],
      through: { attributes: [] as string[] },
    };

    const orgProjectInclude = {
      model: Project,
      as: 'project',
      where: { organizationId: orgId },
      required: true,
      attributes: [] as string[],
    };

    const [
      assignedTaskCount,
      overdueCount,
      dueSoonCount,
      assignedTasks,
      dueSoonPerProject,
      recentActivity,
      members,
    ] = await Promise.all([
      Task.count({ include: [assigneeInclude, orgProjectInclude] }),

      Task.count({
        where: { dueDate: { [Op.lt]: today } },
        include: [assigneeInclude, orgProjectInclude],
      }),

      Task.count({
        where: { dueDate: { [Op.between]: [today, in7Days] } },
        include: [assigneeInclude, orgProjectInclude],
      }),

      Task.findAll({
        include: [
          { ...assigneeInclude },
          {
            model: Project,
            as: 'project',
            where: { organizationId: orgId },
            required: true,
            attributes: ['id', 'name'],
          },
          {
            model: KanbanColumn,
            as: 'column',
            required: true,
            attributes: ['name'],
          },
        ],
        order: [['dueDate', 'ASC']],
        limit: 8,
        attributes: ['id', 'title', 'priority', 'dueDate', 'projectId'],
      }),

      myProjectIds.length > 0
        ? Task.findAll({
            where: {
              projectId: { [Op.in]: myProjectIds },
              dueDate: { [Op.between]: [today, in7Days] },
            },
            attributes: ['projectId', [fn('COUNT', col('id')), 'count']],
            group: ['projectId'],
            raw: true,
          })
        : Promise.resolve([]),

      myProjectIds.length > 0
        ? ActivityLog.findAll({
            where: { projectId: { [Op.in]: myProjectIds } },
            include: [
              { model: User, as: 'actor', attributes: ['id', 'name', 'avatarUrl'] },
              { model: Project, as: 'project', attributes: ['id', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
            limit: 15,
          })
        : Promise.resolve([]),

      OrganizationMember.findAll({
        where: { organizationId: orgId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'avatarUrl'],
        }],
        attributes: ['userId', 'role'],
      }),
    ]);

    const dueSoonMap = new Map<string, number>(
      (dueSoonPerProject as any[]).map((r) => [r.projectId, parseInt(r.count, 10)])
    );

    return {
      stats: {
        projectCount: myProjectIds.length,
        assignedTaskCount: assignedTaskCount as number,
        overdueCount: overdueCount as number,
        dueSoonCount: dueSoonCount as number,
      },
      myProjects: myMemberships.map((m) => {
        const project = (m as any).project;
        return {
          id: project.id as string,
          name: project.name as string,
          description: project.description as string | null,
          myRole: m.role as string,
          dueSoonCount: dueSoonMap.get(project.id) ?? 0,
        };
      }),
      assignedTasks: assignedTasks.map((t) => {
        const task = t as any;
        return {
          id: task.id as string,
          title: task.title as string,
          priority: task.priority as string,
          dueDate: task.dueDate as string | null,
          projectId: task.projectId as string,
          projectName: task.project?.name as string ?? '',
          columnName: task.column?.name as string ?? '',
        };
      }),
      recentActivity: (recentActivity as any[]).map((entry) => ({
        id: entry.id as string,
        type: entry.type as string,
        createdAt: entry.createdAt as string,
        projectId: entry.projectId as string,
        projectName: entry.project?.name as string ?? '',
        metadata: (entry.metadata ?? {}) as Record<string, unknown>,
        actor: {
          id: entry.actor?.id as string,
          name: entry.actor?.name as string,
          avatarUrl: entry.actor?.avatarUrl as string | null ?? null,
        },
      })),
      members: (members as any[]).map((m) => ({
        id: m.user?.id as string ?? m.userId,
        name: m.user?.name as string ?? '',
        email: m.user?.email as string ?? '',
        avatarUrl: m.user?.avatarUrl as string | null ?? null,
        role: m.role as string,
      })),
    };
  },
};

export const organizationBanRepository = {
  create: async (organizationId: string, userId: string, bannedBy: string): Promise<OrganizationBanInstance> => {
    return await OrganizationBan.create({ organizationId, userId, bannedBy });
  },

  findOne: async (organizationId: string, userId: string): Promise<OrganizationBanInstance | null> => {
    return await OrganizationBan.findOne({ where: { organizationId, userId } });
  },

  findAllByOrg: async (organizationId: string): Promise<OrganizationBanInstance[]> => {
    return await OrganizationBan.findAll({
      where: { organizationId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatarUrl'] },
        { model: User, as: 'bannedByUser', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });
  },

  delete: async (organizationId: string, userId: string): Promise<number> => {
    return await OrganizationBan.destroy({ where: { organizationId, userId } });
  },
};

