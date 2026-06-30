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
  myRole?: 'PROJECT_MANAGER' | 'MEMBER' | null;
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
  role: 'PROJECT_MANAGER' | 'MEMBER';
  addedAt?: Date;
}

export type ProjectMemberCreationAttributes = Optional<
  ProjectMembers,
  'id' | 'addedAt'
>;

export interface ProjectMemberInstance
  extends Model<ProjectMembers, ProjectMemberCreationAttributes>, ProjectMembers {}
