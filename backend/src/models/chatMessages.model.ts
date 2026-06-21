import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { ChatMessageInstance } from '../types/chatMessages.types.js';

export const ChatMessage = sequelize.define<ChatMessageInstance>(
  'ChatMessage',
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
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'chat_messages',
    timestamps: true,
    updatedAt: false, // Schema only requires createdAt for chat messages
  }
);
