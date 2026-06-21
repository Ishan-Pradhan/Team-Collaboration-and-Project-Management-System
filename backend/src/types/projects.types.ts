import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';
import type { OrganizationInstance } from './organizations.types.js';

export interface Projects {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
  organization?: OrganizationInstance;
  creator?: UserInstance;
}

export type ProjectCreationAttributes = Optional<
  Projects,
  'id' | 'description' | 'status' | 'createdAt' | 'updatedAt'
>;

export interface ProjectInstance
  extends Model<Projects, ProjectCreationAttributes>, Projects {}

export interface ProjectMembers {
  id: string;
  projectId: string;
  userId: string;
  addedAt?: Date;
}

export type ProjectMemberCreationAttributes = Optional<
  ProjectMembers,
  'id' | 'addedAt'
>;

export interface ProjectMemberInstance
  extends Model<ProjectMembers, ProjectMemberCreationAttributes>, ProjectMembers {}
