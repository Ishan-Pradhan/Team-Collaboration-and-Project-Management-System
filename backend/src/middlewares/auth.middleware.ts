import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import type { AuthRequest, JwtPayload } from '../types/auth.types.js';
import { userRepository } from '../repositories/users.repository.js';

export const verifyJWT = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const token =
    req.cookies?.accessToken ||
    req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError(401, 'Unauthorized request');
  }

  try {
    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET as string,
    ) as JwtPayload;
    const user = await userRepository.findById(decodedToken.id);
    if (!user) throw new ApiError(401, 'User not found');

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Access token has expired');
    }
    throw new ApiError(401, 'Invalid access token');
  }
};

export const isAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.role !== 'SUPER_ADMIN') {
    throw new ApiError(403, 'Unauthorized request. Superadmin only.');
  }

  next();
};

export const isSuperAdmin = isAdmin;

export const isOrganizationOwner = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const organizationId = req.params.organizationId as string;
  if (!organizationId) throw new ApiError(400, 'Organization ID is required');

  const { Organization } = await import('../models/index.js');
  const org = await Organization.findByPk(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (org.ownerId !== user.id) {
    throw new ApiError(403, 'Only the organization owner can perform this action');
  }

  next();
};

export const isOrganizationAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const organizationId = req.params.organizationId || req.body.organizationId || req.query.organizationId;
  if (!organizationId) {
    throw new ApiError(400, 'Organization ID is required');
  }

  const { Organization, OrganizationMember } = await import('../models/index.js');

  const org = await Organization.findByPk(organizationId);
  if (!org) {
    throw new ApiError(404, 'Organization not found');
  }

  if (org.isSuspended) {
    throw new ApiError(403, 'This organization has been suspended');
  }

  if (org.ownerId === user.id) {
    return next();
  }

  const member = await OrganizationMember.findOne({
    where: { organizationId, userId: user.id },
  });

  if (!member || member.role !== 'ORG_ADMIN') {
    throw new ApiError(403, 'Unauthorized request. Organization Admin role required.');
  }

  next();
};

export const checkBlockedUser = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'User is blocked');
  }
  next();
};

export const isOrganizationMember = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const organizationId = req.params.organizationId || req.body.organizationId || req.query.organizationId;
  if (!organizationId) {
    throw new ApiError(400, 'Organization ID is required');
  }

  const { Organization, OrganizationMember } = await import('../models/index.js');

  const org = await Organization.findByPk(organizationId);
  if (!org) {
    throw new ApiError(404, 'Organization not found');
  }

  if (org.isSuspended) {
    throw new ApiError(403, 'This organization has been suspended');
  }

  if (org.ownerId === user.id) {
    return next();
  }

  const member = await OrganizationMember.findOne({
    where: { organizationId, userId: user.id },
  });

  if (!member) {
    throw new ApiError(403, 'Unauthorized request. Organization membership required.');
  }

  next();
};

export const isChannelOrgAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelId = req.params.channelId as string;
  if (!channelId) throw new ApiError(400, 'Channel ID is required');

  const { Channel, Organization, OrganizationMember } = await import('../models/index.js');

  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const org = await Organization.findByPk(channel.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (org.isSuspended) {
    throw new ApiError(403, 'This organization has been suspended');
  }

  if (!org.featureFlags.chatEnabled) {
    throw new ApiError(403, 'Chat has been disabled for this organization');
  }

  if (org.ownerId === user.id) {
    return next();
  }

  const member = await OrganizationMember.findOne({
    where: { organizationId: channel.organizationId, userId: user.id },
  });

  if (!member || member.role !== 'ORG_ADMIN') {
    throw new ApiError(403, 'Unauthorized request. Organization Admin role required.');
  }

  next();
};

export const isChannelMember = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelId = req.params.channelId as string;
  if (!channelId) throw new ApiError(400, 'Channel ID is required');

  const { Channel, ChannelMember, Organization } = await import('../models/index.js');

  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const org = await Organization.findByPk(channel.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (org.isSuspended) {
    throw new ApiError(403, 'This organization has been suspended');
  }

  if (!org.featureFlags.chatEnabled) {
    throw new ApiError(403, 'Chat has been disabled for this organization');
  }

  const membership = await ChannelMember.findOne({ where: { channelId, userId: user.id } });
  if (!membership) {
    throw new ApiError(403, 'Unauthorized request. Channel membership required.');
  }

  next();
};
