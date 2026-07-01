import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/db.js';

export type ActivityLogType = 'task_created' | 'task_moved' | 'task_deleted' | 'comment_added' | 'member_added';

export interface ActivityLogAttributes {
  id: string;
  projectId: string;
  actorId: string;
  type: ActivityLogType;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
}

export type ActivityLogCreationAttributes = Optional<
  ActivityLogAttributes,
  'id' | 'entityType' | 'entityId' | 'metadata' | 'createdAt'
>;

export interface ActivityLogInstance
  extends Model<ActivityLogAttributes, ActivityLogCreationAttributes>,
    ActivityLogAttributes {}

export const ActivityLog = sequelize.define<ActivityLogInstance>(
  'ActivityLog',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    actorId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING(50), allowNull: false },
    entityType: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    entityId: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
  },
  {
    tableName: 'activity_logs',
    timestamps: true,
    updatedAt: false,
  },
);
