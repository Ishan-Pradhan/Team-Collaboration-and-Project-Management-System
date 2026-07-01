import { Router } from 'express';
import {
  verifyJWT,
  isOrganizationAdmin,
  isOrganizationMember,
  isOrganizationOwner,
} from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createOrganization,
  listMyOrganizations,
  inviteUserToOrganization,
  acceptOrganizationInvitation,
  listOrganizationMembers,
  removeOrganizationMember,
  leaveOrganization,
  deleteOrganization,
  getOrganizationBySlug,
  updateOrganization,
  listPendingInvites,
  revokeInvite,
  changeMemberRole,
  getOrgDashboard,
} from '../controllers/organization.controller.js';
import {
  createOrganizationSchema,
  inviteUserSchema,
  acceptInviteSchema,
  organizationParamSchema,
  memberParamSchema,
  updateOrganizationSchema,
  slugParamSchema,
  inviteParamSchema,
  changeMemberRoleSchema,
} from '../validations/organization.validation.js';

const router = Router();

/**
 * @swagger
 * /organizations:
 *   post:
 *     tags: [Organizations]
 *     summary: Create a new organization
 *     description: Creates an organization and assigns the creator as the Owner/Admin.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: My Awesome Company
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Organization created successfully }
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *   get:
 *     tags: [Organizations]
 *     summary: Get all organizations current user belongs to
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of organizations retrieved successfully
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
router
  .route('/')
  .post(verifyJWT, validate(createOrganizationSchema), createOrganization)
  .get(verifyJWT, listMyOrganizations);

/**
 * @swagger
 * /organizations/accept-invite:
 *   post:
 *     tags: [Organizations]
 *     summary: Accept invitation to an organization
 *     description: Verifies matching email and adds user to the organization.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 example: 9283fjasd8fj2390fjasd8f2
 *     responses:
 *       200:
 *         description: Successfully joined organization
 *       400:
 *         description: Invalid/expired token
 *       403:
 *         description: Email mismatch or organization suspended
 */
router
  .route('/accept-invite')
  .post(verifyJWT, validate(acceptInviteSchema), acceptOrganizationInvitation);

/**
 * @swagger
 * /organizations/{organizationId}/invites:
 *   post:
 *     tags: [Organizations]
 *     summary: Invite a user by email
 *     description: Only Organization Admins can invite users. Generates invitation and sends email via Resend.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: member@company.com
 *     responses:
 *       201:
 *         description: Invitation sent
 *       400:
 *         description: User is already a member or pending invite exists
 *       403:
 *         description: Not organization admin
 */
router
  .route('/:organizationId/invites')
  .post(
    verifyJWT,
    isOrganizationAdmin,
    validate(inviteUserSchema),
    inviteUserToOrganization
  )
  .get(verifyJWT, isOrganizationAdmin, listPendingInvites);

router
  .route('/:organizationId/invites/:inviteId')
  .delete(verifyJWT, isOrganizationAdmin, validate(inviteParamSchema), revokeInvite);

/**
 * @swagger
 * /organizations/{organizationId}/members:
 *   get:
 *     tags: [Organizations]
 *     summary: List organization members
 *     description: List all members of an organization. Accessible by any member.
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
 *         description: Members retrieved
 *       403:
 *         description: Not a member
 */
router
  .route('/:organizationId/members')
  .get(
    verifyJWT,
    isOrganizationMember,
    validate(organizationParamSchema),
    listOrganizationMembers
  );

/**
 * @swagger
 * /organizations/{organizationId}/members/{userId}:
 *   delete:
 *     tags: [Organizations]
 *     summary: Remove a member from the organization
 *     description: Only Organization Admins can remove members. Owner cannot be removed.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       400:
 *         description: Cannot remove owner
 *       403:
 *         description: Not organization admin
 */
router
  .route('/:organizationId/members/me')
  .delete(verifyJWT, isOrganizationMember, validate(organizationParamSchema), leaveOrganization);

router
  .route('/:organizationId/members/:userId')
  .delete(
    verifyJWT,
    isOrganizationAdmin,
    validate(memberParamSchema),
    removeOrganizationMember
  );

router
  .route('/:organizationId/members/:userId/role')
  .patch(verifyJWT, isOrganizationAdmin, validate(changeMemberRoleSchema), changeMemberRole);

/**
 * @swagger
 * /organizations/slug/{slug}:
 *   get:
 *     tags: [Organizations]
 *     summary: Get organization details by slug
 *     description: Retrieve details of an organization using its unique URL slug. Accessible by any organization member.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *           example: my-awesome-company
 *     responses:
 *       200:
 *         description: Organization details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of the organization
 *       404:
 *         description: Organization not found
 */
router
  .route('/slug/:slug')
  .get(
    verifyJWT,
    validate(slugParamSchema),
    getOrganizationBySlug
  );

/**
 * @swagger
 * /organizations/{organizationId}:
 *   put:
 *     tags: [Organizations]
 *     summary: Update organization details
 *     description: Only Organization Admins can update name, description, or logoUrl.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: My New Company Name
 *               description:
 *                 type: string
 *                 example: A cool description
 *               logoUrl:
 *                 type: string
 *                 format: url
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not organization admin
 *       404:
 *         description: Organization not found
 */
router
  .route('/:organizationId')
  .put(verifyJWT, isOrganizationAdmin, validate(updateOrganizationSchema), updateOrganization)
  .delete(verifyJWT, isOrganizationOwner, validate(organizationParamSchema), deleteOrganization);

router.get(
  '/:organizationId/dashboard',
  verifyJWT,
  isOrganizationMember,
  validate(organizationParamSchema),
  getOrgDashboard,
);

export default router;
