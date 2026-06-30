import { Project, ProjectMember, User } from '../models/index.js';
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
