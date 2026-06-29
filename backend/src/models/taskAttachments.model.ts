import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { TaskAttachmentInstance } from '../types/tasks.types.js';

export const TaskAttachment = sequelize.define<TaskAttachmentInstance>(
  'TaskAttachment',
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
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    uploadedById: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    fileUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cloudinaryPublicId: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    fileType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: 'task_attachments',
    timestamps: true,
  },
);
