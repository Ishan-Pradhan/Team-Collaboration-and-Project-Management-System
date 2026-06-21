import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { ProjectInstance } from '../types/projects.types.js';

export const Project = sequelize.define<ProjectInstance>(
  'Project',
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
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'ARCHIVED'),
      defaultValue: 'ACTIVE',
      allowNull: false,
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: 'projects',
    timestamps: true,
  }
);
