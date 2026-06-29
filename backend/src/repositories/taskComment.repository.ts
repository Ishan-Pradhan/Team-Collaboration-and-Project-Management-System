import { TaskComment, User } from '../models/index.js';
import type { TaskCommentCreationAttributes, TaskCommentInstance } from '../types/tasks.types.js';

export const taskCommentRepository = {
  create: async (data: TaskCommentCreationAttributes): Promise<TaskCommentInstance> => {
    const comment = await TaskComment.create(data);
    return await taskCommentRepository.findById(comment.id) as TaskCommentInstance;
  },

  findById: async (id: string): Promise<TaskCommentInstance | null> => {
    return await TaskComment.findByPk(id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'avatarUrl'] }],
    });
  },

  findByTask: async (taskId: string): Promise<TaskCommentInstance[]> => {
    return await TaskComment.findAll({
      where: { taskId },
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'avatarUrl'] }],
      order: [['createdAt', 'ASC']],
    });
  },

  delete: async (id: string, authorId: string): Promise<number> => {
    return await TaskComment.destroy({ where: { id, authorId } });
  },

  deleteByAdmin: async (id: string): Promise<number> => {
    return await TaskComment.destroy({ where: { id } });
  },
};
