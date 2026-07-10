import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';
import {
  listProjectTasks,
  createTask,
  getTask,
  updateTask,
  moveTask,
  deleteTask,
  listColumns,
  createColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
  listComments,
  createComment,
  deleteComment,
  listSubtasks,
  createSubtask,
  toggleSubtask,
  deleteSubtask,
  listTaskAttachments,
  listProjectFiles,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
} from '../controllers/task.controller.js';
import { z } from 'zod';

const router = Router();

// Shared param schemas (inline for simplicity)
const projectParamSchema = {
  params: z.object({ projectId: z.string().uuid() }),
};
const taskParamSchema = {
  params: z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() }),
};
const columnParamSchema = {
  params: z.object({ projectId: z.string().uuid(), columnId: z.string().uuid() }),
};

const createTaskSchema = {
  params: z.object({ projectId: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(2000).nullable().optional(),
    columnId: z.string().uuid(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    assigneeIds: z.array(z.string().uuid()).optional(),
    dueDate: z.string().nullable().optional(),
  }),
};

const updateTaskSchema = {
  params: z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).nullable().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    assigneeIds: z.array(z.string().uuid()).optional(),
    dueDate: z.string().nullable().optional(),
  }),
};

const moveTaskSchema = {
  params: z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() }),
  body: z.object({
    columnId: z.string().uuid(),
    position: z.number().int().min(0).optional(),
  }),
};

const createColumnSchema = {
  params: z.object({ projectId: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(100),
    color: z.string().max(7).optional(),
  }),
};

const updateColumnSchema = {
  params: z.object({ projectId: z.string().uuid(), columnId: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    color: z.string().max(7).optional(),
  }),
};

const reorderColumnsSchema = {
  params: z.object({ projectId: z.string().uuid() }),
  body: z.object({
    orderedIds: z.array(z.string().uuid()).min(1),
  }),
};

/**
 * @swagger
 * /projects/{projectId}/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List all tasks in a project
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
 *         description: Tasks retrieved
 *       403:
 *         description: Not project member
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task
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
 *             required: [title, columnId]
 *             properties:
 *               title:
 *                 type: string
 *               columnId:
 *                 type: string
 *                 format: uuid
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *               assigneeId:
 *                 type: string
 *                 format: uuid
 *               dueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Task created
 */
router
  .route('/projects/:projectId/tasks')
  .get(verifyJWT, validate(projectParamSchema), listProjectTasks)
  .post(verifyJWT, validate(createTaskSchema), createTask);

/**
 * @swagger
 * /projects/{projectId}/tasks/{taskId}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get task detail
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Task detail
 *       404:
 *         description: Task not found
 *   put:
 *     tags: [Tasks]
 *     summary: Update task (title, description, priority, assignee, due date)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Task updated
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Task deleted
 */
router
  .route('/projects/:projectId/tasks/:taskId')
  .get(verifyJWT, validate(taskParamSchema), getTask)
  .put(verifyJWT, validate(updateTaskSchema), updateTask)
  .delete(verifyJWT, validate(taskParamSchema), deleteTask);

/**
 * @swagger
 * /projects/{projectId}/tasks/{taskId}/move:
 *   patch:
 *     tags: [Tasks]
 *     summary: Move task to a different column
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [columnId]
 *             properties:
 *               columnId:
 *                 type: string
 *                 format: uuid
 *               position:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Task moved
 */
router.patch(
  '/projects/:projectId/tasks/:taskId/move',
  verifyJWT,
  validate(moveTaskSchema),
  moveTask
);

/**
 * @swagger
 * /projects/{projectId}/columns:
 *   get:
 *     tags: [KanbanColumns]
 *     summary: List kanban columns in a project
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Columns retrieved
 *   post:
 *     tags: [KanbanColumns]
 *     summary: Create a new column
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *               color:
 *                 type: string
 *                 example: "#6f8c78"
 *     responses:
 *       201:
 *         description: Column created
 */
router
  .route('/projects/:projectId/columns')
  .get(verifyJWT, validate(projectParamSchema), listColumns)
  .post(verifyJWT, validate(createColumnSchema), createColumn);

/**
 * @swagger
 * /projects/{projectId}/columns/reorder:
 *   patch:
 *     tags: [KanbanColumns]
 *     summary: Reorder all columns
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderedIds]
 *             properties:
 *               orderedIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Columns reordered
 */
router.patch(
  '/projects/:projectId/columns/reorder',
  verifyJWT,
  validate(reorderColumnsSchema),
  reorderColumns
);

/**
 * @swagger
 * /projects/{projectId}/columns/{columnId}:
 *   put:
 *     tags: [KanbanColumns]
 *     summary: Update a column name or color
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: columnId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Column updated
 *   delete:
 *     tags: [KanbanColumns]
 *     summary: Delete a column
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: columnId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Column deleted
 */
router
  .route('/projects/:projectId/columns/:columnId')
  .put(verifyJWT, validate(updateColumnSchema), updateColumn)
  .delete(verifyJWT, validate(columnParamSchema), deleteColumn);

// ─── Comments ────────────────────────────────────────────────
const commentParamSchema = {
  params: z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() }),
};
const commentDeleteSchema = {
  params: z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    commentId: z.string().uuid(),
  }),
};
const createCommentSchema = {
  params: z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() }),
  body: z.object({
    content: z.string().min(1).max(5000),
    replyToId: z.string().uuid().optional().nullable(),
  }),
};

router
  .route('/projects/:projectId/tasks/:taskId/comments')
  .get(verifyJWT, validate(commentParamSchema), listComments)
  .post(verifyJWT, validate(createCommentSchema), createComment);

router.delete(
  '/projects/:projectId/tasks/:taskId/comments/:commentId',
  verifyJWT,
  validate(commentDeleteSchema),
  deleteComment,
);

// ─── Subtasks ─────────────────────────────────────────────────
const subtaskParamSchema = {
  params: z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() }),
};
const createSubtaskSchema = {
  params: z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() }),
  body: z.object({ title: z.string().min(1).max(500) }),
};
const subtaskActionSchema = {
  params: z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    subtaskId: z.string().uuid(),
  }),
};

router
  .route('/projects/:projectId/tasks/:taskId/subtasks')
  .get(verifyJWT, validate(subtaskParamSchema), listSubtasks)
  .post(verifyJWT, validate(createSubtaskSchema), createSubtask);

router.patch(
  '/projects/:projectId/tasks/:taskId/subtasks/:subtaskId/toggle',
  verifyJWT,
  validate(subtaskActionSchema),
  toggleSubtask,
);

router.delete(
  '/projects/:projectId/tasks/:taskId/subtasks/:subtaskId',
  verifyJWT,
  validate(subtaskActionSchema),
  deleteSubtask,
);

// ─── Attachments ──────────────────────────────────────────────
const attachmentParamSchema = {
  params: z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() }),
};
const attachmentDeleteSchema = {
  params: z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    attachmentId: z.string().uuid(),
  }),
};

router
  .route('/projects/:projectId/tasks/:taskId/attachments')
  .get(verifyJWT, validate(attachmentParamSchema), listTaskAttachments)
  .post(verifyJWT, validate(attachmentParamSchema), uploadMiddleware.single('file'), uploadAttachment);

router.delete(
  '/projects/:projectId/tasks/:taskId/attachments/:attachmentId',
  verifyJWT,
  validate(attachmentDeleteSchema),
  deleteAttachment,
);

router.get(
  '/projects/:projectId/tasks/:taskId/attachments/:attachmentId/download',
  verifyJWT,
  validate(attachmentDeleteSchema),
  downloadAttachment,
);

// ─── Project Files (all files in a project) ───────────────────
router.get(
  '/projects/:projectId/files',
  verifyJWT,
  validate({ params: z.object({ projectId: z.string().uuid() }) }),
  listProjectFiles,
);

export default router;
