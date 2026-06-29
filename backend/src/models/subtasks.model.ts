import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { SubtaskInstance } from '../types/tasks.types.js';

export const Subtask = sequelize.define<SubtaskInstance>(
  'Subtask',
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
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: 'subtasks',
    timestamps: true,
  },
);
