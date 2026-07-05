import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';

export interface Organizations {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  isSuspended: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  owner?: UserInstance;
}

export type OrganizationCreationAttributes = Optional<
  Organizations,
  'id' | 'description' | 'logoUrl' | 'isSuspended' | 'createdAt' | 'updatedAt'
>;

export interface OrganizationInstance
  extends Model<Organizations, OrganizationCreationAttributes>, Organizations { }

export interface OrganizationMembers {
  id: string;
  organizationId: string;
  userId: string;
  role: 'ORG_ADMIN' | 'MEMBER';
  joinedAt?: Date;
  isMuted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  organization?: OrganizationInstance;
  user?: UserInstance;
}

export type OrganizationMemberCreationAttributes = Optional<
  OrganizationMembers,
  'id' | 'role' | 'joinedAt' | 'isMuted' | 'createdAt' | 'updatedAt'
>;

export interface OrganizationMemberInstance
  extends Model<OrganizationMembers, OrganizationMemberCreationAttributes>, OrganizationMembers { }

export interface OrganizationInvites {
  id: string;
  organizationId: string;
  email: string;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  invitedById: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OrganizationInviteCreationAttributes = Optional<
  OrganizationInvites,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>;

export interface OrganizationInviteInstance
  extends Model<OrganizationInvites, OrganizationInviteCreationAttributes>, OrganizationInvites { }

export interface OrganizationBans {
  id: string;
  organizationId: string;
  userId: string;
  bannedBy: string | null;
  createdAt?: Date;
  user?: UserInstance;
  bannedByUser?: UserInstance;
}

export type OrganizationBanCreationAttributes = Optional<
  OrganizationBans,
  'id' | 'createdAt'
>;

export interface OrganizationBanInstance
  extends Model<OrganizationBans, OrganizationBanCreationAttributes>, OrganizationBans {}
