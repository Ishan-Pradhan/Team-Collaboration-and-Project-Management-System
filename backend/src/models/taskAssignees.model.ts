import { DataTypes, Model, type Optional } from 'sequelize';
import { sequelize } from '../config/db.js';

interface TaskAssigneeAttributes {
  id: string;
  taskId: string;
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type TaskAssigneeCreationAttributes = Optional<TaskAssigneeAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export interface TaskAssigneeInstance
  extends Model<TaskAssigneeAttributes, TaskAssigneeCreationAttributes>,
    TaskAssigneeAttributes {}

export const TaskAssignee = sequelize.define<TaskAssigneeInstance>(
  'TaskAssignee',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    taskId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
  },
  { tableName: 'task_assignees', timestamps: true },
);
