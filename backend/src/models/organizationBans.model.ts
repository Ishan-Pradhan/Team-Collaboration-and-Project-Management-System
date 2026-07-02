import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { OrganizationBanInstance } from '../types/organizations.types.js';

export const OrganizationBan = sequelize.define<OrganizationBanInstance>(
  'OrganizationBan',
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    bannedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: 'organization_bans',
    timestamps: true,
    updatedAt: false,
  },
);
