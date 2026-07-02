import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import {
  organizationRepository,
  organizationMemberRepository,
  organizationInviteRepository,
  organizationBanRepository,
  dashboardRepository,
} from '../repositories/organization.repository.js';
import type { OrganizationInstance } from '../types/organizations.types.js';
import { userRepository } from '../repositories/users.repository.js';
import { Notification } from '../models/index.js';
import crypto from 'crypto';
import { cascadeRemoveUserFromOrgChannels, autoJoinUserToPublicChannels } from './channel.controller.js';

async function notifyAdminsOfMemberLeave(
  organizationId: string,
  ownerId: string,
  orgName: string,
  leavingUserId: string,
  leavingUserName: string,
  wasRemoved: boolean,
) {
  const adminIds = await organizationMemberRepository.findAdminIds(organizationId, ownerId);
  const recipients = adminIds.filter((id) => id !== leavingUserId);
  if (recipients.length === 0) return;

  const title = wasRemoved
    ? `${leavingUserName} was removed from ${orgName}`
    : `${leavingUserName} left ${orgName}`;
  const body = wasRemoved
    ? `A member was removed from your workspace.`
    : `A member has left your workspace.`;

  await Promise.all(
    recipients.map((userId) =>
      Notification.create({
        userId,
        type: 'member_left',
        title,
        body,
        entityType: 'organization',
        entityId: organizationId,
      })
    )
  );
}

const generateSlug = async (name: string): Promise<string> => {
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  let slug = baseSlug || 'org';
  const { Organization } = await import('../models/index.js');
  let exists = await Organization.findOne({ where: { slug } });
  if (exists) {
    const randomHex = crypto.randomBytes(2).toString('hex');
    slug = `${baseSlug}-${randomHex}`;
  }
  return slug;
};

// ─────────────────────────────────────────────────────────────
// USER ORGANIZATION ACTIONS
// ─────────────────────────────────────────────────────────────

// Create Organization
export const createOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name } = req.body as { name?: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new ApiError(400, 'Organization name is required');
    }

    const slug = await generateSlug(name);

    // Create the organization
    const org = await organizationRepository.create({
      name: name.trim(),
      slug,
      description: null,
      logoUrl: null,
      ownerId: user.id,
      isSuspended: false,
    });

    // Also add the owner as an admin member in OrganizationMembers
    await organizationMemberRepository.create({
      organizationId: org.id,
      userId: user.id,
      role: 'ORG_ADMIN',
    });

    return res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: org,
    });
  }
);

// List User's Organizations (where they are a member or owner)
export const listMyOrganizations = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Find all memberships
    const memberships = await organizationMemberRepository.findAllByUserId(user.id);

    const organizations = memberships
      .map((m) => m.organization)
      .filter((o): o is NonNullable<typeof o> => o !== undefined && o !== null && !o.isSuspended);

    return ok(res, organizations, 'Organizations retrieved successfully');
  }
);

// Invite User to Organization
export const inviteUserToOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const { email } = req.body as { email?: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new ApiError(400, 'Valid email is required');
    }

    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    const targetEmail = email.toLowerCase().trim();

    // Check if the user is already a member
    const existingMemberUser = await userRepository.findByEmail(targetEmail);
    if (existingMemberUser) {
      const isMember = await organizationMemberRepository.findOne({
        organizationId,
        userId: existingMemberUser.id,
      });
      if (isMember) {
        throw new ApiError(400, 'User is already a member of this organization');
      }

      const ban = await organizationBanRepository.findOne(organizationId, existingMemberUser.id);
      if (ban) {
        throw new ApiError(400, 'This user is banned from this organization');
      }
    }

    // Check if there is already a pending invite
    const existingInvite = await organizationInviteRepository.findOnePending(
      organizationId,
      targetEmail
    );

    if (existingInvite) {
      throw new ApiError(400, 'A pending invite already exists for this email');
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const invite = await organizationInviteRepository.create({
      organizationId,
      email: targetEmail,
      token,
      status: 'PENDING',
      invitedById: user.id,
      expiresAt,
    });

    // Send email using Resend
    let emailSent = false;
    let inviteLink: string | undefined;

    try {
      const { sendVerificationEmail: _, sendPasswordResetEmail: __, sendOrganizationInviteEmail } = await import(
        '../services/email.service.js'
      );
      const result = await sendOrganizationInviteEmail(
        invite.email,
        org.name,
        token,
        user.name
      );
      emailSent = true;
      inviteLink = result.inviteLink;
    } catch (error) {
      console.error('Failed to send invitation email:', error);
    }

    return res.status(201).json({
      success: true,
      message: emailSent
        ? 'Invitation email sent successfully'
        : 'Invitation created, but email could not be sent',
      data: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        ...(process.env.NODE_ENV === 'development' && inviteLink ? { inviteLink } : {}),
      },
    });
  }
);

// Accept Organization Invitation
export const acceptOrganizationInvitation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { token } = req.body as { token?: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    if (!token) {
      throw new ApiError(400, 'Token is required');
    }

    const invite = await organizationInviteRepository.findOneByToken(token);

    if (!invite) {
      throw new ApiError(404, 'Invalid or expired invitation token');
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      invite.status = 'EXPIRED';
      await invite.save();
      throw new ApiError(400, 'Invitation token has expired');
    }

    // The user accepting must match the invite email
    if (invite.email !== user.email.toLowerCase()) {
      throw new ApiError(403, 'This invitation was sent to a different email address');
    }

    const org = await organizationRepository.findById(invite.organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    if (org.isSuspended) {
      throw new ApiError(403, 'This organization has been suspended');
    }

    const ban = await organizationBanRepository.findOne(invite.organizationId, user.id);
    if (ban) {
      throw new ApiError(400, 'This user is banned from this organization');
    }

    // Add user as member
    const [member] = await organizationMemberRepository.findOrCreate(
      invite.organizationId,
      user.id,
      { role: 'MEMBER' }
    );
    await autoJoinUserToPublicChannels(invite.organizationId, user.id);

    // Mark invite as accepted
    invite.status = 'ACCEPTED';
    await invite.save();

    return ok(res, member, 'Successfully joined organization');
  }
);

// List Organization Members
export const listOrganizationMembers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;

    const members = await organizationMemberRepository.findAllMembersInOrg(organizationId);

    return ok(res, members, 'Members retrieved successfully');
  }
);

async function removeMemberFromOrg(org: OrganizationInstance, userId: string): Promise<void> {
  const member = await organizationMemberRepository.findOne({ organizationId: org.id, userId });
  if (!member) throw new ApiError(404, 'Member not found in organization');

  const memberUser = await userRepository.findById(userId);
  await member.destroy();
  await cascadeRemoveUserFromOrgChannels(org.id, userId, memberUser?.name ?? 'A member');

  notifyAdminsOfMemberLeave(
    org.id, org.ownerId, org.name,
    userId, memberUser?.name ?? 'A member', true,
  ).catch(() => {});
}

// Remove Member from Organization
export const removeOrganizationMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const userId = req.params.userId as string;
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    if (org.ownerId === userId) {
      throw new ApiError(400, 'Cannot remove the organization owner');
    }

    await removeMemberFromOrg(org, userId);

    return ok(res, null, 'Member removed successfully');
  }
);

// Leave Organization (any member except owner)
export const leaveOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organization not found');

    if (org.ownerId === user.id) {
      throw new ApiError(400, 'Organization owner cannot leave. Transfer ownership or delete the organization.');
    }

    const member = await organizationMemberRepository.findOne({ organizationId, userId: user.id });
    if (!member) throw new ApiError(404, 'You are not a member of this organization');

    await member.destroy();
    await cascadeRemoveUserFromOrgChannels(organizationId, user.id, user.name);

    notifyAdminsOfMemberLeave(
      organizationId, org.ownerId, org.name,
      user.id, user.name, false,
    ).catch(() => {});

    return ok(res, null, 'You have left the organization');
  }
);

// Delete Organization (owner only)
export const deleteOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organization not found');

    if (org.ownerId !== user.id) {
      throw new ApiError(403, 'Only the organization owner can delete the organization');
    }

    await organizationRepository.delete(organizationId);
    return ok(res, null, 'Organization deleted successfully');
  }
);

// ─────────────────────────────────────────────────────────────
// SUPERADMIN ACTIONS
// ─────────────────────────────────────────────────────────────

// Get all organizations (Superadmin only)
export const getAllOrganizations = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const organizations = await organizationRepository.findAllWithOwner();

    return ok(res, organizations, 'All organizations retrieved successfully');
  }
);

// Toggle Suspend Organization (Superadmin only)
export const toggleSuspendOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;

    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    org.isSuspended = !org.isSuspended;
    await org.save();

    return ok(
      res,
      org,
      org.isSuspended
        ? 'Organization suspended successfully'
        : 'Organization unsuspended successfully'
    );
  }
);

// Get Organization by Slug
export const getOrganizationBySlug = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { slug } = req.params as { slug: string };
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const org = await organizationRepository.findBySlug(slug);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    // Check if user is a member or the owner
    const membership = await organizationMemberRepository.findOne({
      organizationId: org.id,
      userId: user.id,
    });

    if (!membership && org.ownerId !== user.id) {
      throw new ApiError(403, 'You are not a member of this organization');
    }

    return ok(res, org, 'Organization retrieved successfully');
  }
);

// List Pending Invites
export const listPendingInvites = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const invites = await organizationInviteRepository.findPendingByOrg(organizationId);
    return ok(res, invites, 'Pending invites retrieved');
  }
);

// Revoke Invite
export const revokeInvite = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId, inviteId } = req.params as { organizationId: string; inviteId: string };
    const deleted = await organizationInviteRepository.deleteById(inviteId, organizationId);
    if (!deleted) throw new ApiError(404, 'Invite not found or already accepted');
    return ok(res, null, 'Invite revoked');
  }
);

// Change Member Role
export const changeMemberRole = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = req.params as { organizationId: string; userId: string };
    const { role } = req.body as { role: 'ORG_ADMIN' | 'MEMBER' };

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organization not found');
    if (org.ownerId === userId) throw new ApiError(400, 'Cannot change the owner\'s role');

    const updated = await organizationMemberRepository.updateRole(organizationId, userId, role);
    if (!updated) throw new ApiError(404, 'Member not found');

    return ok(res, updated, 'Member role updated');
  }
);

// Update Organization Details
export const updateOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const { name, description, logoUrl } = req.body as { name?: string; description?: string | null; logoUrl?: string | null };
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    // Only owner or ORG_ADMIN can update
    const membership = await organizationMemberRepository.findOne({
      organizationId,
      userId: user.id,
    });

    if (org.ownerId !== user.id && (!membership || membership.role !== 'ORG_ADMIN')) {
      throw new ApiError(403, 'Only organization admins can update organization details');
    }

    // If name is changed, generate a new slug and check conflicts
    let slug = org.slug;
    if (name && name.trim() !== org.name) {
      slug = await generateSlug(name);
    }

    const updatedOrg = await organizationRepository.update(organizationId, {
      name: name ? name.trim() : org.name,
      description: description !== undefined ? description : org.description,
      logoUrl: logoUrl !== undefined ? logoUrl : org.logoUrl,
      slug,
    });

    return ok(res, updatedOrg, 'Organization updated successfully');
  }
);

// GET /organizations/:organizationId/dashboard
export const getOrgDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organization not found');

    const data = await dashboardRepository.getDashboardData(organizationId, user.id);
    return ok(res, data, 'Dashboard data retrieved');
  }
);

// Ban Member from Organization
export const banOrganizationMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const userId = req.params.userId as string;
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organization not found');

    if (org.ownerId === userId) {
      throw new ApiError(400, 'Cannot ban the organization owner');
    }

    const existingBan = await organizationBanRepository.findOne(organizationId, userId);
    if (existingBan) {
      throw new ApiError(400, 'User is already banned from this organization');
    }

    await removeMemberFromOrg(org, userId);
    await organizationBanRepository.create(organizationId, userId, user.id);

    return ok(res, null, 'Member banned successfully');
  }
);

// Unban Member
export const unbanOrganizationMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const userId = req.params.userId as string;

    const deleted = await organizationBanRepository.delete(organizationId, userId);
    if (deleted === 0) throw new ApiError(404, 'No active ban found for this user');

    return ok(res, null, 'Member unbanned successfully');
  }
);

// List Banned Users
export const listOrganizationBans = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const bans = await organizationBanRepository.findAllByOrg(organizationId);
    return ok(res, bans, 'Banned users retrieved successfully');
  }
);

// Get a member's profile (bio, job title, org role) — any org member can view
export const getMemberProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = req.params as { organizationId: string; userId: string };

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organization not found');

    const membership = await organizationMemberRepository.findOne({ organizationId, userId });
    if (!membership) throw new ApiError(404, 'User is not a member of this organization');

    const targetUser = await userRepository.findById(userId);
    if (!targetUser) throw new ApiError(404, 'User not found');

    const orgRole = org.ownerId === userId ? 'Owner' : membership.role === 'ORG_ADMIN' ? 'Admin' : 'Member';

    return ok(res, {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      avatarUrl: targetUser.avatarUrl,
      bio: targetUser.bio,
      jobTitle: targetUser.jobTitle,
      orgRole,
      joinedAt: membership.joinedAt,
    }, 'Member profile retrieved successfully');
  }
);
