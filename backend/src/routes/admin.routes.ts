import { Router } from 'express';
import {
  blockAndUnblockUser,
  getAllUsers,
  getUserStats,
  getGrowthStats,
  promoteUser,
  demoteUser,
  getOrganizationDetail,
  toggleOrgFeature,
  getAuditLog,
} from '../controllers/admin.controller.js';
import { isAdmin, verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  toggleBlockUserSchema,
  growthStatsQuerySchema,
  promoteUserSchema,
  organizationIdParamSchema,
  toggleOrgFeatureSchema,
  auditLogQuerySchema,
} from '../validations/admin.validation.js';

const router = Router();

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all platform users
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserPublic'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 */
router.route('/users').get(verifyJWT, isAdmin, getAllUsers);

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get platform-wide stats
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Platform stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers: { type: integer, example: 128 }
 *                     blockedUsers: { type: integer, example: 2 }
 *                     adminUsers: { type: integer, example: 3 }
 *                     totalOrganizations: { type: integer, example: 14 }
 *                     suspendedOrgs: { type: integer, example: 1 }
 *                     totalProjects: { type: integer, example: 47 }
 *                     totalTasks: { type: integer, example: 902 }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 */
router.route('/stats').get(verifyJWT, isAdmin, getUserStats);

/**
 * @swagger
 * /admin/stats/growth:
 *   get:
 *     tags: [Admin]
 *     summary: Get daily new-user and new-organization counts
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, maximum: 90, default: 30 }
 *         description: Number of trailing days to include.
 *     responses:
 *       200:
 *         description: Growth stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date: { type: string, format: date }
 *                           count: { type: integer }
 *                     organizations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date: { type: string, format: date }
 *                           count: { type: integer }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 */
router.route('/stats/growth').get(verifyJWT, isAdmin, validate(growthStatsQuerySchema), getGrowthStats);

/**
 * @swagger
 * /admin/toggle-block/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Block or unblock a user
 *     description: Blocked users cannot log in. Toggles the user's active state.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User's block state updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 *       404:
 *         description: User not found
 */
router
  .route('/toggle-block/:id')
  .patch(
    verifyJWT,
    isAdmin,
    validate(toggleBlockUserSchema),
    blockAndUnblockUser,
  );

/**
 * @swagger
 * /admin/users/{id}/promote:
 *   patch:
 *     tags: [Admin]
 *     summary: Promote a user to super admin
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User promoted to super admin successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 *       404:
 *         description: User not found
 */
router.route('/users/:id/promote').patch(verifyJWT, isAdmin, validate(promoteUserSchema), promoteUser);

/**
 * @swagger
 * /admin/users/{id}/demote:
 *   patch:
 *     tags: [Admin]
 *     summary: Demote a super admin to a regular user
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User demoted to regular user successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 *       404:
 *         description: User not found
 */
router.route('/users/:id/demote').patch(verifyJWT, isAdmin, validate(promoteUserSchema), demoteUser);

/**
 * @swagger
 * /admin/organizations:
 *   get:
 *     tags: [Admin]
 *     summary: List all organizations on the platform
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 */
router.route('/organizations').get(verifyJWT, isAdmin, async (req, res, next) => {
  const { getAllOrganizations } = await import('../controllers/organization.controller.js');
  return getAllOrganizations(req, res, next);
});

/**
 * @swagger
 * /admin/organizations/{organizationId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get full detail for a single organization
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization detail retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 *       404:
 *         description: Organization not found
 */
router
  .route('/organizations/:organizationId')
  .get(verifyJWT, isAdmin, validate(organizationIdParamSchema), getOrganizationDetail);

/**
 * @swagger
 * /admin/organizations/{organizationId}/toggle-suspend:
 *   patch:
 *     tags: [Admin]
 *     summary: Suspend or unsuspend an organization
 *     description: Suspended organizations lose access to the platform for all their members.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization's suspension state updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 *       404:
 *         description: Organization not found
 */
router.route('/organizations/:organizationId/toggle-suspend').patch(verifyJWT, isAdmin, async (req, res, next) => {
  const { toggleSuspendOrganization } = await import('../controllers/organization.controller.js');
  return toggleSuspendOrganization(req, res, next);
});

/**
 * @swagger
 * /admin/organizations/{organizationId}/features:
 *   patch:
 *     tags: [Admin]
 *     summary: Toggle an organization's feature flag
 *     description: Controls whether chat or the personal calendar is enabled for an organization. Notifies the organization owner.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [flag, enabled]
 *             properties:
 *               flag: { type: string, enum: [chatEnabled, calendarEnabled] }
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Feature flag updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 *       404:
 *         description: Organization not found
 */
router
  .route('/organizations/:organizationId/features')
  .patch(verifyJWT, isAdmin, validate(toggleOrgFeatureSchema), toggleOrgFeature);

/**
 * @swagger
 * /admin/audit-log:
 *   get:
 *     tags: [Admin]
 *     summary: List super admin actions
 *     description: Paginated audit trail of destructive/privileged admin actions (blocks, promotions, suspensions, feature toggles).
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           action: { type: string, example: feature_toggled }
 *                           targetType: { type: string, example: organization }
 *                           targetId: { type: string, format: uuid }
 *                           metadata: { type: object }
 *                           createdAt: { type: string, format: date-time }
 *                           actor:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               name: { type: string }
 *                               email: { type: string, format: email }
 *                     meta:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 */
router.route('/audit-log').get(verifyJWT, isAdmin, validate(auditLogQuerySchema), getAuditLog);

export default router;
