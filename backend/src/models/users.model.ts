import { DataTypes } from 'sequelize';

import { sequelize } from '../config/db.js';
import type { UserInstance } from '../types/users.types.js';
import { USER_ROLES } from '../constants/index.js';

export const User = sequelize.define<UserInstance>(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    role: {
      type: DataTypes.ENUM(USER_ROLES.USER, USER_ROLES.SUPERADMIN),
      defaultValue: USER_ROLES.USER,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    authProvider: {
      type: DataTypes.ENUM('local', 'google', 'github'),
      defaultValue: 'local',
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: 'Users',
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ['passwordHash', 'refreshToken'] },
    },
  },
);
