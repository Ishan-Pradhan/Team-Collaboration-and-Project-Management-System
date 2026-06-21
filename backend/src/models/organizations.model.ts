import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { OrganizationInstance } from '../types/organizations.types.js';

export const Organization = sequelize.define<OrganizationInstance>(
  'Organization',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    logoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    isSuspended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: 'Organizations',
    timestamps: true,
  }
);
