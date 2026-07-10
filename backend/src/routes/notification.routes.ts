import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadChannels,
  markReadByEntity,
  deleteNotification,
} from '../controllers/notification.controller.js';
import { notificationParamSchema, readByEntitySchema } from '../validations/notification.validation.js';

const router = Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the current user's notifications
 *     description: Returns notifications newest first, across all organizations the user belongs to.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized
 */
router.route('/notifications').get(verifyJWT, listNotifications);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get the current user's unread notification count
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer, example: 3 }
 *       401:
 *         description: Unauthorized
 */
router.route('/notifications/unread-count').get(verifyJWT, getUnreadNotificationCount);

/**
 * @swagger
 * /notifications/unread-channels:
 *   get:
 *     tags: [Notifications]
 *     summary: List chat channel IDs with unread activity for the current user
 *     description: Powers the unread-dot indicators in the chat sidebar.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Unread channel IDs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { type: string, format: uuid }
 *       401:
 *         description: Unauthorized
 */
router.route('/notifications/unread-channels').get(verifyJWT, getUnreadChannels);

/**
 * @swagger
 * /notifications/mark-all-read:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all of the current user's notifications as read
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Notifications marked as read
 *       401:
 *         description: Unauthorized
 */
router.route('/notifications/mark-all-read').post(verifyJWT, markAllNotificationsRead);

/**
 * @swagger
 * /notifications/read-by-entity:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark notifications for a specific entity as read
 *     description: Used when a user opens the task/channel/event a notification points to, so its notifications clear without needing their individual IDs.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityType, entityId]
 *             properties:
 *               entityType: { type: string, example: task }
 *               entityId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Matching notifications marked as read
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.route('/notifications/read-by-entity').post(verifyJWT, validate(readByEntitySchema), markReadByEntity);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found
 */
router.route('/notifications/:id/read').patch(verifyJWT, validate(notificationParamSchema), markNotificationRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found
 */
router.route('/notifications/:id').delete(verifyJWT, validate(notificationParamSchema), deleteNotification);

export default router;
