import { Op, type WhereOptions } from 'sequelize';
import { User } from '../models/users.model.js';
import type {
  UserCreationAttributes,
  UserInstance,
  Users,
} from '../types/users.types.js';

const buildUserWhere = (search?: string): WhereOptions<Users> => {
  if (!search) return {};

  return {
    [Op.or]: [
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ],
  };
};

export const userRepository = {
  findAll: async (options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }) => {
    const { limit, offset, search } = options || {};

    return await User.findAll({
      where: buildUserWhere(search),
      order: [['createdAt', 'DESC']],
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
    });
  },

  findAndCountAll: async (options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }) => {
    const { limit, offset, search } = options || {};

    return await User.findAndCountAll({
      where: buildUserWhere(search),
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
      order: [['createdAt', 'DESC']],
    });
  },

  count: async (options?: { search?: string }) => {
    const { search } = options || {};

    return await User.count({ where: buildUserWhere(search) });
  },

  findById: async (id: string) => {
    return await User.findByPk(id);
  },

  findByIdWithSecrets: async (id: string) => {
    return await User.unscoped().findByPk(id);
  },

  findByEmail: async (email: string) => {
    return await User.findOne({ where: { email } });
  },

  // Bypasses the defaultScope (which excludes `password`) — use ONLY for login
  findByEmailWithPassword: async (email: string) => {
    return await User.unscoped().findOne({ where: { email } });
  },

  create: async (userData: UserCreationAttributes): Promise<UserInstance> => {
    return await User.create(userData);
  },

  update: async (id: string, data: Partial<Pick<Users, 'name' | 'avatarUrl'>>): Promise<UserInstance | null> => {
    const user = await User.findByPk(id);
    if (!user) return null;
    return await user.update(data);
  },

  getUsersStats: async () => {
    const totalUsers = await User.count();
    const blockedCount = await User.count({ where: { isActive: false } });
    const adminsCount = await User.count({ where: { role: 'SUPER_ADMIN' } });

    return {
      totalUsers,
      blockedCount,
      adminsCount,
    };
  },
};
