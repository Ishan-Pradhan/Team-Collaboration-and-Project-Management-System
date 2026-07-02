import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { MessageInstance } from '../types/channels.types.js';

export const Message = sequelize.define<MessageInstance>(
  'Message',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('TEXT', 'SYSTEM'),
      allowNull: false,
      defaultValue: 'TEXT',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'messages',
    timestamps: true,
    updatedAt: false,
  },
);
