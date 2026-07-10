import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { TaskCommentInstance } from '../types/tasks.types.js';

export const TaskComment = sequelize.define<TaskCommentInstance>(
  'TaskComment',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    taskId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    replyToId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: 'task_comments',
    timestamps: true,
  }
);
