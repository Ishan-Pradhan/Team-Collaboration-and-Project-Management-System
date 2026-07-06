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
  TaskAttachment,
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
  OrganizationFeatureFlags,
} from '../types/organizations.types.js';
import { isDoneColumnName } from '../utils/doneColumn.utils.js';

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

  count: async (): Promise<number> => {
    return await Organization.count();
  },

  countSuspended: async (): Promise<number> => {
    return await Organization.count({ where: { isSuspended: true } });
  },

  countCreatedSince: async (since: Date): Promise<{ date: string; count: number }[]> => {
    const rows = await Organization.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'ASC']],
      raw: true,
    });
    return (rows as unknown as { date: string; count: string }[]).map((r) => ({
      date: r.date,
      count: parseInt(r.count, 10),
    }));
  },

  findDetailById: async (id: string) => {
    const org = await Organization.findByPk(id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
    });
    if (!org) return null;

    const projects = await Project.findAll({ where: { organizationId: id }, attributes: ['id'] });
    const projectIds = projects.map((p) => p.id);

    const [memberCount, taskCount, attachmentCount, lastActivity] = await Promise.all([
      OrganizationMember.count({ where: { organizationId: id } }),
      projectIds.length > 0
        ? Task.count({ where: { projectId: { [Op.in]: projectIds } } })
        : Promise.resolve(0),
      projectIds.length > 0
        ? TaskAttachment.count({ where: { projectId: { [Op.in]: projectIds } } })
        : Promise.resolve(0),
      projectIds.length > 0
        ? ActivityLog.findOne({
            where: { projectId: { [Op.in]: projectIds } },
            order: [['createdAt', 'DESC']],
            attributes: ['createdAt'],
          })
        : Promise.resolve(null),
    ]);

    return {
      org,
      memberCount,
      projectCount: projectIds.length,
      taskCount,
      attachmentCount,
      lastActivityAt: lastActivity?.createdAt ?? null,
    };
  },

  updateFeatureFlags: async (
    id: string,
    flag: keyof OrganizationFeatureFlags,
    enabled: boolean,
  ): Promise<OrganizationInstance | null> => {
    const org = await Organization.findByPk(id);
    if (!org) return null;
    const featureFlags = { ...org.featureFlags, [flag]: enabled };
    return await org.update({ featureFlags });
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

      Task.findAll({
        where: { dueDate: { [Op.lt]: today } },
        include: [
          assigneeInclude,
          orgProjectInclude,
          { model: KanbanColumn, as: 'column', required: true, attributes: ['name'] },
        ],
        attributes: ['id'],
      }).then((rows) => rows.filter((t) => !isDoneColumnName((t as any).column?.name)).length),

      Task.findAll({
        where: { dueDate: { [Op.between]: [today, in7Days] } },
        include: [
          assigneeInclude,
          orgProjectInclude,
          { model: KanbanColumn, as: 'column', required: true, attributes: ['name'] },
        ],
        attributes: ['id'],
      }).then((rows) => rows.filter((t) => !isDoneColumnName((t as any).column?.name)).length),

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

  getOrgAnalytics: async (organizationId: string) => {
    const projects = await Project.findAll({ where: { organizationId }, attributes: ['id', 'name'] });
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return {
        completionTrend: { created: [], completed: [] },
        statusBreakdown: [],
        memberWorkload: [],
        projectHealth: [],
      };
    }

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in2Days = new Date(today);
    in2Days.setDate(today.getDate() + 2);

    const [createdRows, movedLogs, tasks, members, lastActivityRows] = await Promise.all([
      Task.findAll({
        where: { projectId: { [Op.in]: projectIds }, createdAt: { [Op.gte]: since } },
        attributes: [
          [fn('DATE', col('createdAt')), 'date'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: [fn('DATE', col('createdAt'))],
        order: [[fn('DATE', col('createdAt')), 'ASC']],
        raw: true,
      }),
      ActivityLog.findAll({
        where: { projectId: { [Op.in]: projectIds }, type: 'task_moved', createdAt: { [Op.gte]: since } },
        attributes: ['createdAt', 'metadata'],
        raw: true,
      }),
      Task.findAll({
        where: { projectId: { [Op.in]: projectIds } },
        include: [
          { model: KanbanColumn, as: 'column', attributes: ['name'] },
          { model: User, as: 'assignees', attributes: ['id', 'name', 'avatarUrl'], through: { attributes: [] } },
        ],
        attributes: ['id', 'projectId', 'dueDate'],
      }),
      OrganizationMember.findAll({
        where: { organizationId },
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatarUrl'] }],
        attributes: ['userId'],
      }),
      ActivityLog.findAll({
        where: { projectId: { [Op.in]: projectIds } },
        attributes: ['projectId', [fn('MAX', col('createdAt')), 'lastActivityAt']],
        group: ['projectId'],
        raw: true,
      }),
    ]);

    // Task completion trend — "created" is a plain Task.createdAt count;
    // "completed" has no dedicated column, so it's inferred from ActivityLog's
    // task_moved entries landing in a done-named column (same convention as
    // isDoneColumnName elsewhere).
    const createdMap = new Map<string, number>(
      (createdRows as unknown as { date: string; count: string }[]).map((r) => [r.date, parseInt(r.count, 10)]),
    );
    const completedMap = new Map<string, number>();
    for (const log of movedLogs as unknown as { createdAt: string; metadata: { toColumn?: string } | null }[]) {
      if (!isDoneColumnName(log.metadata?.toColumn)) continue;
      const date = new Date(log.createdAt).toISOString().slice(0, 10);
      completedMap.set(date, (completedMap.get(date) ?? 0) + 1);
    }
    const completionTrend = {
      created: [] as { date: string; count: number }[],
      completed: [] as { date: string; count: number }[],
    };
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      completionTrend.created.push({ date: key, count: createdMap.get(key) ?? 0 });
      completionTrend.completed.push({ date: key, count: completedMap.get(key) ?? 0 });
    }

    // Task status breakdown — counts across all org projects, grouped by the
    // task's current column name (column names vary per project, so this is
    // reduced in JS rather than a SQL group-by on the joined column).
    const statusMap = new Map<string, number>();
    for (const task of tasks as any[]) {
      const name = (task.column?.name as string | undefined) ?? 'Unknown';
      statusMap.set(name, (statusMap.get(name) ?? 0) + 1);
    }
    const statusBreakdown = [...statusMap.entries()].map(([name, count]) => ({ name, count }));

    // Member workload — count of currently-open (non-done-column) task
    // assignments per org member.
    const workloadMap = new Map<string, { userId: string; name: string; avatarUrl: string | null; count: number }>();
    for (const m of members as any[]) {
      if (m.user) {
        workloadMap.set(m.userId, {
          userId: m.userId,
          name: m.user.name as string,
          avatarUrl: (m.user.avatarUrl as string | null) ?? null,
          count: 0,
        });
      }
    }
    for (const task of tasks as any[]) {
      if (isDoneColumnName(task.column?.name)) continue;
      for (const assignee of task.assignees ?? []) {
        const entry = workloadMap.get(assignee.id);
        if (entry) entry.count += 1;
      }
    }
    const memberWorkload = [...workloadMap.values()].sort((a, b) => b.count - a.count);

    // Project health — per-project overdue/due-soon counts (non-done tasks
    // only) plus last activity timestamp.
    const tasksByProject = new Map<string, any[]>();
    for (const task of tasks as any[]) {
      const list = tasksByProject.get(task.projectId as string) ?? [];
      list.push(task);
      tasksByProject.set(task.projectId as string, list);
    }
    const lastActivityMap = new Map(
      (lastActivityRows as unknown as { projectId: string; lastActivityAt: string }[]).map((r) => [
        r.projectId,
        r.lastActivityAt,
      ]),
    );

    const projectHealth = projects.map((project) => {
      const projectTasks = tasksByProject.get(project.id) ?? [];
      let overdueCount = 0;
      let dueSoonCount = 0;
      for (const task of projectTasks) {
        if (isDoneColumnName(task.column?.name) || !task.dueDate) continue;
        const due = new Date(task.dueDate);
        if (due < today) overdueCount += 1;
        else if (due <= in2Days) dueSoonCount += 1;
      }
      return {
        id: project.id,
        name: project.name,
        taskCount: projectTasks.length,
        overdueCount,
        dueSoonCount,
        lastActivityAt: lastActivityMap.get(project.id) ?? null,
      };
    });

    return { completionTrend, statusBreakdown, memberWorkload, projectHealth };
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

