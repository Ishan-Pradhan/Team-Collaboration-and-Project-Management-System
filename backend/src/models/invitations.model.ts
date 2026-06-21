import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { OrganizationInviteInstance } from '../types/organizations.types.js';

export const Invitation = sequelize.define<OrganizationInviteInstance>(
  'Invitation',
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
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'),
      defaultValue: 'PENDING',
      allowNull: false,
    },
    invitedById: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'invitations',
    timestamps: true,
  }
);
