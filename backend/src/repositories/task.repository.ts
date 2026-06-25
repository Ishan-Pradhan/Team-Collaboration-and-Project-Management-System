import { Task, User } from '../models/index.js';
import type { TaskCreationAttributes, TaskInstance } from '../types/tasks.types.js';

export const taskRepository = {
  create: async (data: TaskCreationAttributes): Promise<TaskInstance> => {
    return await Task.create(data);
  },

  findById: async (id: string): Promise<TaskInstance | null> => {
    return await Task.findByPk(id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'avatarUrl'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });
  },

  findByProject: async (projectId: string): Promise<TaskInstance[]> => {
    return await Task.findAll({
      where: { projectId },
      order: [
        ['columnId', 'ASC'],
        ['position', 'ASC'],
      ],
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'avatarUrl'] },
      ],
    });
  },

  findByColumn: async (columnId: string): Promise<TaskInstance[]> => {
    return await Task.findAll({
      where: { columnId },
      order: [['position', 'ASC']],
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'avatarUrl'] },
      ],
    });
  },

  update: async (
    id: string,
    data: Partial<TaskCreationAttributes>
  ): Promise<TaskInstance | null> => {
    const task = await Task.findByPk(id);
    if (!task) return null;
    return await task.update(data);
  },

  delete: async (id: string): Promise<number> => {
    return await Task.destroy({ where: { id } });
  },

  // Move task to a different column and/or update position
  move: async (
    id: string,
    columnId: string,
    position: number
  ): Promise<TaskInstance | null> => {
    const task = await Task.findByPk(id);
    if (!task) return null;
    return await task.update({ columnId, position });
  },

  // Count tasks in a column (used to determine position for new tasks)
  countByColumn: async (columnId: string): Promise<number> => {
    return await Task.count({ where: { columnId } });
  },
};
