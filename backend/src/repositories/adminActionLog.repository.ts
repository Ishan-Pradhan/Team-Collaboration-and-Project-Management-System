import { AdminActionLog, User } from '../models/index.js';
import type { AdminActionLogCreationAttributes, AdminActionLogInstance } from '../types/adminActionLog.types.js';

export const adminActionLogRepository = {
  create: async (data: AdminActionLogCreationAttributes): Promise<AdminActionLogInstance> => {
    return await AdminActionLog.create(data);
  },

  findAndCountAll: async (options: {
    limit: number;
    offset: number;
  }): Promise<{ rows: AdminActionLogInstance[]; count: number }> => {
    return await AdminActionLog.findAndCountAll({
      include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: options.limit,
      offset: options.offset,
    });
  },
};
