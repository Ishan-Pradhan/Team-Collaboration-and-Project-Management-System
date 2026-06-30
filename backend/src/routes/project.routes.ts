import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  archiveProject,
  unarchiveProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  listProjectMembers,
  updateProjectMemberRole,
} from '../controllers/project.controller.js';
import {
  createProjectSchema,
  orgParamSchema,
  updateProjectSchema,
  projectParamSchema,
  addProjectMemberSchema,
  removeProjectMemberSchema,
  updateProjectMemberRoleSchema,
} from '../validations/project.validation.js';

const router = Router();

/**
 * @swagger
 * /organizations/{organizationId}/projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 *     description: Creates a project. Restricted to organization owners and admins. Creator is auto-assigned as Project Manager.
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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Mobile App Redesign
 *               description:
 *                 type: string
 *                 example: Redesign the core application views.
 *     responses:
 *       201:
 *         description: Project created successfully
 *       403:
 *         description: Not an organization admin/owner
 *   get:
 *     tags: [Projects]
 *     summary: List projects in organization
 *     description: Admins/owners see all projects. Members see only their projects (with myRole field).
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
 *         description: Projects retrieved successfully
 *       403:
 *         description: Not organization member
 */
router.post(
  '/organizations/:organizationId/projects',
  verifyJWT,
  validate(createProjectSchema),
  createProject
);

router.get(
  '/organizations/:organizationId/projects',
  verifyJWT,
  validate(orgParamSchema),
  listProjects
);

/**
 * @swagger
 * /projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project detail
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Details retrieved
 *       403:
 *         description: Not project member
 *       404:
 *         description: Project not found
 *   put:
 *     tags: [Projects]
 *     summary: Update project
 *     description: Allowed for org admins/owners and project managers.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated successfully
 *       403:
 *         description: Not authorized
 */
router
  .route('/projects/:projectId')
  .get(verifyJWT, validate(projectParamSchema), getProject)
  .put(verifyJWT, validate(updateProjectSchema), updateProject);

/**
 * @swagger
 * /projects/{projectId}/archive:
 *   patch:
 *     tags: [Projects]
 *     summary: Archive project
 *     description: Allowed for org admins/owners and project managers.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Archived successfully
 */
router.patch(
  '/projects/:projectId/archive',
  verifyJWT,
  validate(projectParamSchema),
  archiveProject
);

/**
 * @swagger
 * /projects/{projectId}/unarchive:
 *   patch:
 *     tags: [Projects]
 *     summary: Restore an archived project
 *     description: Allowed for org admins/owners and project managers.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project restored successfully
 * /projects/{projectId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Permanently delete a project
 *     description: Irreversible. Restricted to org owners and admins. Cascades to all tasks, columns, members, and files.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project deleted permanently
 *       403:
 *         description: Not an organization admin/owner
 */
router.patch(
  '/projects/:projectId/unarchive',
  verifyJWT,
  validate(projectParamSchema),
  unarchiveProject
);

router.delete(
  '/projects/:projectId',
  verifyJWT,
  validate(projectParamSchema),
  deleteProject
);

/**
 * @swagger
 * /projects/{projectId}/members:
 *   get:
 *     tags: [Projects]
 *     summary: List project members
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Members retrieved (includes role field)
 *   post:
 *     tags: [Projects]
 *     summary: Add member to project
 *     description: Allowed for org admins/owners and project managers.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Member added successfully
 */
router
  .route('/projects/:projectId/members')
  .get(verifyJWT, validate(projectParamSchema), listProjectMembers)
  .post(verifyJWT, validate(addProjectMemberSchema), addProjectMember);

/**
 * @swagger
 * /projects/{projectId}/members/{userId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Remove member from project
 *     description: Allowed for org admins/owners, project managers, and the member themselves.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 */
router.delete(
  '/projects/:projectId/members/:userId',
  verifyJWT,
  validate(removeProjectMemberSchema),
  removeProjectMember
);

/**
 * @swagger
 * /projects/{projectId}/members/{userId}/role:
 *   patch:
 *     tags: [Projects]
 *     summary: Update a member's project role
 *     description: Org owners and admins can promote/demote a member to/from Project Manager.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [PROJECT_MANAGER, MEMBER]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       403:
 *         description: Not an organization admin/owner
 */
router.patch(
  '/projects/:projectId/members/:userId/role',
  verifyJWT,
  validate(updateProjectMemberRoleSchema),
  updateProjectMemberRole
);

export default router;
