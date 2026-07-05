import { Op, fn, col } from 'sequelize';
import { Project, ProjectMember, User, Task, KanbanColumn } from '../models/index.js';
import type {
  ProjectCreationAttributes,
  ProjectInstance,
  ProjectMemberInstance,
} from '../types/projects.types.js';

export const projectRepository = {
  create: async (data: ProjectCreationAttributes): Promise<ProjectInstance> => {
    return await Project.create(data);
  },

  findById: async (id: string): Promise<ProjectInstance | null> => {
    return await Project.findByPk(id);
  },

  findByOrg: async (orgId: string): Promise<ProjectInstance[]> => {
    return await Project.findAll({
      where: { organizationId: orgId },
    });
  },

  findByOrgForUser: async (orgId: string, userId: string): Promise<(ProjectInstance & { myRole: 'PROJECT_MANAGER' | 'MEMBER' })[]> => {
    const results = await Project.findAll({
      where: { organizationId: orgId },
      include: [
        {
          model: ProjectMember,
          as: 'members',
          where: { userId },
          required: true,
          attributes: ['role'],
        },
      ],
    });

    return results.map((project) => {
      const members = (project as any).members as Array<{ role: string }> | undefined;
      const myRole = (members?.[0]?.role ?? 'MEMBER') as 'PROJECT_MANAGER' | 'MEMBER';
      return Object.assign(project, { myRole });
    });
  },

  findMemberCountsByProjectIds: async (projectIds: string[]): Promise<Map<string, number>> => {
    if (projectIds.length === 0) return new Map();
    const rows = await ProjectMember.findAll({
      where: { projectId: { [Op.in]: projectIds } },
      attributes: ['projectId', [fn('COUNT', col('id')), 'count']],
      group: ['projectId'],
      raw: true,
    });
    return new Map(
      (rows as unknown as { projectId: string; count: string }[]).map((r) => [r.projectId, parseInt(r.count, 10)])
    );
  },

  findTaskCountsByProjectIds: async (projectIds: string[]): Promise<Map<string, number>> => {
    if (projectIds.length === 0) return new Map();
    const rows = await Task.findAll({
      where: { projectId: { [Op.in]: projectIds } },
      attributes: ['projectId', [fn('COUNT', col('id')), 'count']],
      group: ['projectId'],
      raw: true,
    });
    return new Map(
      (rows as unknown as { projectId: string; count: string }[]).map((r) => [r.projectId, parseInt(r.count, 10)])
    );
  },

  findCompletedTaskCountsByProjectIds: async (projectIds: string[]): Promise<Map<string, number>> => {
    if (projectIds.length === 0) return new Map();
    const donePatterns = ['%done%', '%complet%', '%finish%', '%clos%', '%shipped%', '%deployed%', '%released%', '%delivered%'];
    const rows = await Task.findAll({
      where: { projectId: { [Op.in]: projectIds } },
      include: [
        {
          model: KanbanColumn,
          as: 'column',
          attributes: [],
          required: true,
          where: { [Op.or]: donePatterns.map((pattern) => ({ name: { [Op.iLike]: pattern } })) },
        },
      ],
      attributes: ['projectId', [fn('COUNT', col('Task.id')), 'count']],
      group: ['projectId'],
      raw: true,
    });
    return new Map(
      (rows as unknown as { projectId: string; count: string }[]).map((r) => [r.projectId, parseInt(r.count, 10)])
    );
  },

  update: async (
    id: string,
    data: Partial<ProjectCreationAttributes>
  ): Promise<ProjectInstance | null> => {
    const project = await Project.findByPk(id);
    if (!project) return null;
    return await project.update(data);
  },

  archive: async (id: string): Promise<ProjectInstance | null> => {
    const project = await Project.findByPk(id);
    if (!project) return null;
    return await project.update({ status: 'ARCHIVED' });
  },

  unarchive: async (id: string): Promise<ProjectInstance | null> => {
    const project = await Project.findByPk(id);
    if (!project) return null;
    return await project.update({ status: 'ACTIVE' });
  },

  delete: async (id: string): Promise<boolean> => {
    const project = await Project.findByPk(id);
    if (!project) return false;
    await project.destroy();
    return true;
  },

  addMember: async (
    projectId: string,
    userId: string,
    role: 'PROJECT_MANAGER' | 'MEMBER' = 'MEMBER'
  ): Promise<ProjectMemberInstance> => {
    return await ProjectMember.create({ projectId, userId, role });
  },

  removeMember: async (projectId: string, userId: string): Promise<number> => {
    return await ProjectMember.destroy({
      where: { projectId, userId },
    });
  },

  updateMemberRole: async (
    projectId: string,
    userId: string,
    role: 'PROJECT_MANAGER' | 'MEMBER'
  ): Promise<number> => {
    const [count] = await ProjectMember.update(
      { role },
      { where: { projectId, userId } }
    );
    return count;
  },

  findMembers: async (projectId: string): Promise<ProjectMemberInstance[]> => {
    return await ProjectMember.findAll({
      where: { projectId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'avatarUrl'],
        },
      ],
    });
  },

  findMembership: async (
    projectId: string,
    userId: string
  ): Promise<ProjectMemberInstance | null> => {
    return await ProjectMember.findOne({
      where: { projectId, userId },
    });
  },

  isProjectManager: async (projectId: string, userId: string): Promise<boolean> => {
    const membership = await ProjectMember.findOne({
      where: { projectId, userId, role: 'PROJECT_MANAGER' },
    });
    return !!membership;
  },
};
