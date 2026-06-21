import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { KanbanColumnInstance } from '../types/kanbanColumns.types.js';

export const KanbanColumn = sequelize.define<KanbanColumnInstance>(
  'KanbanColumn',
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: 'kanban_columns',
    timestamps: true,
  }
);
