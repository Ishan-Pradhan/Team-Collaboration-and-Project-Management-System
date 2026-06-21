import { Router } from 'express';
import {
  blockAndUnblockUser,
  getAllUsers,
  getUserStats,
} from '../controllers/admin.controller.js';
import { isAdmin, verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { toggleBlockUserSchema } from '../validations/admin.validation.js';

const router = Router();

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin only)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Filter by name or email
 *     responses:
 *       200:
 *         description: Paginated list of users
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
 *                         $ref: '#/components/schemas/UserPublic'
 *                     meta:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.route('/users').get(verifyJWT, isAdmin, getAllUsers);

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get user statistics (admin only)
 *     responses:
 *       200:
 *         description: User statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers: { type: integer, example: 120 }
 *                     blockedUsers: { type: integer, example: 3 }
 *                     adminUsers: { type: integer, example: 2 }
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.route('/stats').get(verifyJWT, isAdmin, getUserStats);

/**
 * @swagger
 * /admin/toggle-block/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Block or unblock a user (admin only)
 *     description: Toggles the `isBlocked` flag on the user. Blocked users cannot log in.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: User ID to block/unblock
 *     responses:
 *       200:
 *         description: User blocked or unblocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 * /admin/organizations:
 *   get:
 *     tags: [Admin]
 *     summary: List all organizations (superadmin only)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all organizations
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
 */
router.route('/organizations').get(verifyJWT, isAdmin, async (req, res, next) => {
  const { getAllOrganizations } = await import('../controllers/organization.controller.js');
  return getAllOrganizations(req, res, next);
});

/**
 * @swagger
 * /admin/organizations/{organizationId}/toggle-suspend:
 *   patch:
 *     tags: [Admin]
 *     summary: Suspend or unsuspend an organization (superadmin only)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Organization suspend status toggled
 */
router.route('/organizations/:organizationId/toggle-suspend').patch(verifyJWT, isAdmin, async (req, res, next) => {
  const { toggleSuspendOrganization } = await import('../controllers/organization.controller.js');
  return toggleSuspendOrganization(req, res, next);
});

export default router;
