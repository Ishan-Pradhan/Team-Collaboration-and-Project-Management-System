import { TaskAttachment, User } from '../models/index.js';
import type { TaskAttachmentCreationAttributes, TaskAttachmentInstance } from '../types/tasks.types.js';

export const taskAttachmentRepository = {
  create: async (data: TaskAttachmentCreationAttributes): Promise<TaskAttachmentInstance> => {
    const att = await TaskAttachment.create(data);
    return await taskAttachmentRepository.findById(att.id) as TaskAttachmentInstance;
  },

  findById: async (id: string): Promise<TaskAttachmentInstance | null> => {
    return await TaskAttachment.findByPk(id, {
      include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'avatarUrl'] }],
    });
  },

  findByTask: async (taskId: string): Promise<TaskAttachmentInstance[]> => {
    return await TaskAttachment.findAll({
      where: { taskId },
      include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'avatarUrl'] }],
      order: [['createdAt', 'DESC']],
    });
  },

  findByProject: async (projectId: string): Promise<TaskAttachmentInstance[]> => {
    return await TaskAttachment.findAll({
      where: { projectId },
      include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'avatarUrl'] }],
      order: [['createdAt', 'DESC']],
    });
  },

  delete: async (id: string): Promise<number> => {
    return await TaskAttachment.destroy({ where: { id } });
  },
};
