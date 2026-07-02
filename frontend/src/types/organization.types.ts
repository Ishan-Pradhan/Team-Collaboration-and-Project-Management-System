// ─── Organization ──────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Member ────────────────────────────────────────────────────

export type OrgMemberRole = 'ORG_ADMIN' | 'MEMBER';

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgMemberRole;
  createdAt: string;
  updatedAt: string;
  // populated by the API (joined from users table)
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

// ─── Pending Invite ────────────────────────────────────────────

export interface PendingInvite {
  id: string;
  email: string;
  status: 'PENDING';
  expiresAt: string;
  createdAt: string;
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PendingInvitesResponse {
  success: boolean;
  message: string;
  data: PendingInvite[];
}

// ─── Invite ────────────────────────────────────────────────────

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';

export interface OrganizationInvite {
  id: string;
  email: string;
  status: InviteStatus;
  /** Only present in development mode responses */
  inviteLink?: string;
}

// ─── API Response wrappers ─────────────────────────────────────

export interface OrganizationsResponse {
  success: boolean;
  message: string;
  data: Organization[];
}

export interface CreateOrganizationResponse {
  success: boolean;
  message: string;
  data: Organization;
}

export interface OrganizationMembersResponse {
  success: boolean;
  message: string;
  data: OrganizationMember[];
}

export interface InviteUserResponse {
  success: boolean;
  message: string;
  data: OrganizationInvite;
}

export interface AcceptInviteResponse {
  success: boolean;
  message: string;
  data: OrganizationMember;
}

// ─── Ban ───────────────────────────────────────────────────────

export interface OrganizationBan {
  id: string;
  organizationId: string;
  userId: string;
  bannedBy: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  bannedByUser?: {
    id: string;
    name: string;
  };
}

export interface OrganizationBansResponse {
  success: boolean;
  message: string;
  data: OrganizationBan[];
}
