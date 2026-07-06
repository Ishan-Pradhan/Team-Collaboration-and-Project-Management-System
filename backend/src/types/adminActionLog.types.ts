import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';

export type AdminAction =
  | 'user_blocked'
  | 'user_unblocked'
  | 'user_promoted'
  | 'user_demoted'
  | 'org_suspended'
  | 'org_unsuspended'
  | 'feature_toggled';

export interface AdminActionLogs {
  id: string;
  actorId: string;
  action: AdminAction;
  targetType: 'user' | 'organization';
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  actor?: UserInstance;
}

export type AdminActionLogCreationAttributes = Optional<
  AdminActionLogs,
  'id' | 'metadata' | 'createdAt'
>;

export interface AdminActionLogInstance
  extends Model<AdminActionLogs, AdminActionLogCreationAttributes>, AdminActionLogs {}
