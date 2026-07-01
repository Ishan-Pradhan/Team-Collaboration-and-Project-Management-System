import { Op } from 'sequelize';
import { ActivityLog, User, Project } from '../models/index.js';
import type { ActivityLogCreationAttributes, ActivityLogType } from '../models/activityLog.model.js';

export const activityLogRepository = {
  log: async (data: ActivityLogCreationAttributes): Promise<void> => {
    await ActivityLog.create(data);
  },

  findByProjects: async (projectIds: string[], limit = 15) => {
    if (projectIds.length === 0) return [];
    return ActivityLog.findAll({
      where: { projectId: { [Op.in]: projectIds } },
      include: [
        { model: User, as: 'actor', attributes: ['id', 'name', 'avatarUrl'] },
        { model: Project, as: 'project', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });
  },
};

export type { ActivityLogType };
