import type { Response } from 'express';
import { userRepository } from '../repositories/users.repository.js';
import { organizationRepository } from '../repositories/organization.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { taskRepository } from '../repositories/task.repository.js';
import { adminActionLogRepository } from '../repositories/adminActionLog.repository.js';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { serializeUser } from '../serializers/user.serializer.js';
import { notifyUser } from '../utils/notify.js';
import {
  buildPaginationMeta,
  getPaginationParams,
} from '../utils/pagination.utils.js';

//    GET ALL USERS (ADMIN ONLY)
export const getAllUsers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = getPaginationParams(req.query);

    const search = String(req.query.search || '').trim();

    const { rows: users, count: totalItems } =
      await userRepository.findAndCountAll({
        limit,
        offset,
        search,
      });

    const safeUsers = users.map(serializeUser);

    return ok(
      res,
      {
        items: safeUsers,
        meta: buildPaginationMeta({
          totalItems,
          page,
          limit,
          itemCount: safeUsers.length,
        }),
      },
      'Users retrieved successfully',
    );
  },
);

//   GET PLATFORM STATS (ADMIN ONLY)
export const getUserStats = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const [
      { totalUsers, blockedCount, adminsCount },
      totalOrganizations,
      suspendedOrgs,
      totalProjects,
      totalTasks,
    ] = await Promise.all([
      userRepository.getUsersStats(),
      organizationRepository.count(),
      organizationRepository.countSuspended(),
      projectRepository.countAll(),
      taskRepository.countAll(),
    ]);

    return ok(
      res,
      {
        totalUsers,
        blockedUsers: blockedCount,
        adminUsers: adminsCount,
        totalOrganizations,
        suspendedOrgs,
        totalProjects,
        totalTasks,
      },
      'Platform stats retrieved successfully',
    );
  },
);

//   GET GROWTH STATS (ADMIN ONLY) — new users/organizations per day
export const getGrowthStats = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const days = Number(req.query.days) || 30;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [userRows, orgRows] = await Promise.all([
      userRepository.countCreatedSince(since),
      organizationRepository.countCreatedSince(since),
    ]);

    const userMap = new Map(userRows.map((r) => [r.date, r.count]));
    const orgMap = new Map(orgRows.map((r) => [r.date, r.count]));

    const users: { date: string; count: number }[] = [];
    const organizations: { date: string; count: number }[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      users.push({ date: key, count: userMap.get(key) ?? 0 });
      organizations.push({ date: key, count: orgMap.get(key) ?? 0 });
    }

    return ok(res, { users, organizations }, 'Growth stats retrieved successfully');
  },
);

// BLOCK / UNBLOCK USER
export const blockAndUnblockUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const actor = req.user;
    if (!actor) throw new ApiError(401, 'Unauthorized');

    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const newStatus = !user.isActive;
    user.isActive = newStatus;

    await user.save();

    await adminActionLogRepository.create({
      actorId: actor.id,
      action: newStatus ? 'user_unblocked' : 'user_blocked',
      targetType: 'user',
      targetId: userId,
    });

    return ok(
      res,
      null,
      `User ${!newStatus ? 'blocked' : 'unblocked'} successfully`,
    );
  },
);

// PROMOTE USER TO SUPER ADMIN
export const promoteUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const actor = req.user;
    if (!actor) throw new ApiError(401, 'Unauthorized');

    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    user.role = 'SUPER_ADMIN';
    await user.save();

    await adminActionLogRepository.create({
      actorId: actor.id,
      action: 'user_promoted',
      targetType: 'user',
      targetId: userId,
    });

    return ok(res, serializeUser(user), 'User promoted to super admin successfully');
  },
);

// DEMOTE USER TO REGULAR USER
export const demoteUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const actor = req.user;
    if (!actor) throw new ApiError(401, 'Unauthorized');

    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    user.role = 'USER';
    await user.save();

    await adminActionLogRepository.create({
      actorId: actor.id,
      action: 'user_demoted',
      targetType: 'user',
      targetId: userId,
    });

    return ok(res, serializeUser(user), 'User demoted to regular user successfully');
  },
);

// GET ORGANIZATION DETAIL (SUPERADMIN ONLY)
export const getOrganizationDetail = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;

    const detail = await organizationRepository.findDetailById(organizationId);
    if (!detail) throw new ApiError(404, 'Organization not found');

    return ok(res, detail, 'Organization detail retrieved successfully');
  },
);

// TOGGLE ORGANIZATION FEATURE FLAG (SUPERADMIN ONLY)
export const toggleOrgFeature = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const { flag, enabled } = req.body as {
      flag: 'chatEnabled' | 'calendarEnabled';
      enabled: boolean;
    };
    const actor = req.user;
    if (!actor) throw new ApiError(401, 'Unauthorized');

    const org = await organizationRepository.updateFeatureFlags(organizationId, flag, enabled);
    if (!org) throw new ApiError(404, 'Organization not found');

    await adminActionLogRepository.create({
      actorId: actor.id,
      action: 'feature_toggled',
      targetType: 'organization',
      targetId: organizationId,
      metadata: { flag, enabled },
    });

    const flagLabel = flag === 'chatEnabled' ? 'Chat' : 'Calendar';
    await notifyUser({
      userId: org.ownerId,
      organizationId: org.id,
      type: 'org_feature_toggled',
      title: `${flagLabel} has been ${enabled ? 'enabled' : 'disabled'} for your organization`,
      body: `A super admin ${enabled ? 'enabled' : 'disabled'} the ${flagLabel.toLowerCase()} feature for ${org.name}.`,
      entityType: 'organization',
      entityId: org.id,
    });

    return ok(res, org, 'Feature flag updated successfully');
  },
);

// GET AUDIT LOG (SUPERADMIN ONLY)
export const getAuditLog = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = getPaginationParams(req.query);

    const { rows, count: totalItems } = await adminActionLogRepository.findAndCountAll({ limit, offset });

    const items = rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      actor: row.actor ? { id: row.actor.id, name: row.actor.name, email: row.actor.email } : null,
    }));

    return ok(
      res,
      {
        items,
        meta: buildPaginationMeta({ totalItems, page, limit, itemCount: items.length }),
      },
      'Audit log retrieved successfully',
    );
  },
);
