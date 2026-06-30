import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { ProjectMemberInstance } from '../types/projects.types.js';

export const ProjectMember = sequelize.define<ProjectMemberInstance>(
  'ProjectMember',
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('PROJECT_MANAGER', 'MEMBER'),
      defaultValue: 'MEMBER',
      allowNull: false,
    },
    addedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    tableName: 'project_members',
    timestamps: false,
  }
);
