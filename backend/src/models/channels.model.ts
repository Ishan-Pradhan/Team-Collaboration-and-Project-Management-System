import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { ChannelInstance } from '../types/channels.types.js';

export const Channel = sequelize.define<ChannelInstance>(
  'Channel',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('PUBLIC', 'PRIVATE', 'DM'),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    dmKey: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
  },
  {
    tableName: 'channels',
    timestamps: true,
  },
);
