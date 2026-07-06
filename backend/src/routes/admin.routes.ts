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

router.route('/users').get(verifyJWT, isAdmin, getAllUsers);

router.route('/stats').get(verifyJWT, isAdmin, getUserStats);

router.route('/stats/growth').get(verifyJWT, isAdmin, validate(growthStatsQuerySchema), getGrowthStats);

router
  .route('/toggle-block/:id')
  .patch(
    verifyJWT,
    isAdmin,
    validate(toggleBlockUserSchema),
    blockAndUnblockUser,
  );

router.route('/users/:id/promote').patch(verifyJWT, isAdmin, validate(promoteUserSchema), promoteUser);

router.route('/users/:id/demote').patch(verifyJWT, isAdmin, validate(promoteUserSchema), demoteUser);

router.route('/organizations').get(verifyJWT, isAdmin, async (req, res, next) => {
  const { getAllOrganizations } = await import('../controllers/organization.controller.js');
  return getAllOrganizations(req, res, next);
});

router
  .route('/organizations/:organizationId')
  .get(verifyJWT, isAdmin, validate(organizationIdParamSchema), getOrganizationDetail);

router.route('/organizations/:organizationId/toggle-suspend').patch(verifyJWT, isAdmin, async (req, res, next) => {
  const { toggleSuspendOrganization } = await import('../controllers/organization.controller.js');
  return toggleSuspendOrganization(req, res, next);
});

router
  .route('/organizations/:organizationId/features')
  .patch(verifyJWT, isAdmin, validate(toggleOrgFeatureSchema), toggleOrgFeature);

router.route('/audit-log').get(verifyJWT, isAdmin, validate(auditLogQuerySchema), getAuditLog);

export default router;
