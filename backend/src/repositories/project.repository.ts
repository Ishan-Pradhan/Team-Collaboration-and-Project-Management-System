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

  findByOrgForUser: async (orgId: string, userId: string): Promise<ProjectInstance[]> => {
    return await Project.findAll({
      where: { organizationId: orgId },
      include: [
        {
          model: ProjectMember,
          as: 'members',
          where: { userId },
          required: true,
        },
      ],
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

  addMember: async (projectId: string, userId: string): Promise<ProjectMemberInstance> => {
    return await ProjectMember.create({ projectId, userId });
  },

  removeMember: async (projectId: string, userId: string): Promise<number> => {
    return await ProjectMember.destroy({
      where: { projectId, userId },
    });
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
};
