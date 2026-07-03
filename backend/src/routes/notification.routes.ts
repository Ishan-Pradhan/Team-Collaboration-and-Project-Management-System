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
} from '../controllers/notification.controller.js';
import { notificationParamSchema, readByEntitySchema } from '../validations/notification.validation.js';

const router = Router();

router.route('/notifications').get(verifyJWT, listNotifications);
router.route('/notifications/unread-count').get(verifyJWT, getUnreadNotificationCount);
router.route('/notifications/unread-channels').get(verifyJWT, getUnreadChannels);
router.route('/notifications/mark-all-read').post(verifyJWT, markAllNotificationsRead);
router.route('/notifications/read-by-entity').post(verifyJWT, validate(readByEntitySchema), markReadByEntity);
router.route('/notifications/:id/read').patch(verifyJWT, validate(notificationParamSchema), markNotificationRead);

export default router;
