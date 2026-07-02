import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { MessageReactionInstance } from '../types/channels.types.js';

export const MessageReaction = sequelize.define<MessageReactionInstance>(
  'MessageReaction',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    messageId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    emoji: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
  },
  {
    tableName: 'message_reactions',
    timestamps: true,
    updatedAt: false,
  },
);
