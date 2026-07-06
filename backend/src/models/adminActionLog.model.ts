import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { AdminActionLogInstance } from '../types/adminActionLog.types.js';

export const AdminActionLog = sequelize.define<AdminActionLogInstance>(
  'AdminActionLog',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    targetType: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    targetId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: 'admin_action_logs',
    timestamps: true,
    updatedAt: false,
  },
);
