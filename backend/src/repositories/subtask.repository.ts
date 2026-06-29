import { Subtask } from '../models/index.js';
import type { SubtaskCreationAttributes, SubtaskInstance } from '../types/tasks.types.js';

export const subtaskRepository = {
  create: async (data: SubtaskCreationAttributes): Promise<SubtaskInstance> => {
    return await Subtask.create(data);
  },

  findByTask: async (taskId: string): Promise<SubtaskInstance[]> => {
    return await Subtask.findAll({
      where: { taskId },
      order: [['position', 'ASC']],
    });
  },

  findById: async (id: string): Promise<SubtaskInstance | null> => {
    return await Subtask.findByPk(id);
  },

  toggle: async (id: string, isCompleted: boolean): Promise<SubtaskInstance | null> => {
    const subtask = await Subtask.findByPk(id);
    if (!subtask) return null;
    return await subtask.update({ isCompleted });
  },

  update: async (id: string, title: string): Promise<SubtaskInstance | null> => {
    const subtask = await Subtask.findByPk(id);
    if (!subtask) return null;
    return await subtask.update({ title });
  },

  delete: async (id: string): Promise<number> => {
    return await Subtask.destroy({ where: { id } });
  },

  countByTask: async (taskId: string): Promise<number> => {
    return await Subtask.count({ where: { taskId } });
  },
};
