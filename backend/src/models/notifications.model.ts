import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { NotificationInstance } from '../types/notifications.types.js';

export const Notification = sequelize.define<NotificationInstance>(
  'Notification',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    entityType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: 'notifications',
    timestamps: true,
    updatedAt: false, // Schema only requires createdAt for notifications
  }
);
