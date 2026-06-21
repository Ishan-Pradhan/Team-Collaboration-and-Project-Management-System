import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { OrganizationMemberInstance } from '../types/organizations.types.js';

export const OrganizationMember = sequelize.define<OrganizationMemberInstance>(
  'OrganizationMember',
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
    role: {
      type: DataTypes.ENUM('ORG_ADMIN', 'MEMBER'),
      defaultValue: 'MEMBER',
      allowNull: false,
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    tableName: 'OrganizationMembers',
    timestamps: true,
  }
);
