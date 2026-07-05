import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { ChannelMemberInstance } from '../types/channels.types.js';

export const ChannelMember = sequelize.define<ChannelMemberInstance>(
  'ChannelMember',
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    isMuted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: 'channel_members',
    timestamps: false,
  },
);
