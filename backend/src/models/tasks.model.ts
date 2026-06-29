import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { TaskInstance } from '../types/tasks.types.js';

export const Task = sequelize.define<TaskInstance>(
  'Task',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    columnId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    priority: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      defaultValue: 'MEDIUM',
      allowNull: false,
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: null,
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    dueSoonNotificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    overdueNotificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: 'tasks',
    timestamps: true,
  }
);
