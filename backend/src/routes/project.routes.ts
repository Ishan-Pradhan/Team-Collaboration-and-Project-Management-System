import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  archiveProject,
  addProjectMember,
  removeProjectMember,
  listProjectMembers,
} from '../controllers/project.controller.js';
import {
  createProjectSchema,
  orgParamSchema,
  updateProjectSchema,
  projectParamSchema,
  addProjectMemberSchema,
  removeProjectMemberSchema,
} from '../validations/project.validation.js';

const router = Router();

/**
 * @swagger
 * /organizations/{organizationId}/projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 *     description: Creates a project and auto-assigns the creator as a member.
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
 *       400:
 *         description: Validation error
 *       403:
 *         description: Not an organization member
 *   get:
 *     tags: [Projects]
 *     summary: List projects in organization
 *     description: Retrieve all active projects within a specific organization.
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
  validate(orgParamSchema), // params matches organizationId validation
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
 *         description: Members retrieved
 *   post:
 *     tags: [Projects]
 *     summary: Add member to project
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

export default router;
