import { Task, TaskAssignee, User, TaskComment, TaskAttachment, Subtask } from '../models/index.js';
import type { TaskCreationAttributes, TaskInstance } from '../types/tasks.types.js';

const ASSIGNEE_INCLUDE = {
  model: User,
  as: 'assignees',
  attributes: ['id', 'name', 'email', 'avatarUrl'],
  through: { attributes: [] },
};

export const taskRepository = {
  create: async (data: TaskCreationAttributes): Promise<TaskInstance> => {
    return await Task.create(data);
  },

  findById: async (id: string): Promise<TaskInstance | null> => {
    return await Task.findByPk(id, {
      include: [
        ASSIGNEE_INCLUDE,
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });
  },

  findByProject: async (projectId: string): Promise<TaskInstance[]> => {
    return await Task.findAll({
      where: { projectId },
      order: [['columnId', 'ASC'], ['position', 'ASC']],
      include: [
        ASSIGNEE_INCLUDE,
        { model: TaskComment, as: 'comments', attributes: ['id'], separate: true },
        { model: TaskAttachment, as: 'attachments', attributes: ['id'], separate: true },
        { model: Subtask, as: 'subtasks', attributes: ['id', 'isCompleted'], separate: true },
      ],
    });
  },

  findByColumn: async (columnId: string): Promise<TaskInstance[]> => {
    return await Task.findAll({
      where: { columnId },
      order: [['position', 'ASC']],
      include: [ASSIGNEE_INCLUDE],
    });
  },

  update: async (id: string, data: Partial<TaskCreationAttributes>): Promise<TaskInstance | null> => {
    const task = await Task.findByPk(id);
    if (!task) return null;
    return await task.update(data);
  },

  // Sync assignees — replaces the full set for a task
  syncAssignees: async (taskId: string, userIds: string[]): Promise<void> => {
    await TaskAssignee.destroy({ where: { taskId } });
    if (userIds.length > 0) {
      await TaskAssignee.bulkCreate(
        userIds.map((userId) => ({ taskId, userId })),
        { ignoreDuplicates: true },
      );
    }
  },

  delete: async (id: string): Promise<number> => {
    return await Task.destroy({ where: { id } });
  },

  move: async (id: string, columnId: string, position: number): Promise<TaskInstance | null> => {
    const task = await Task.findByPk(id);
    if (!task) return null;
    return await task.update({ columnId, position });
  },

  countByColumn: async (columnId: string): Promise<number> => {
    return await Task.count({ where: { columnId } });
  },
};
