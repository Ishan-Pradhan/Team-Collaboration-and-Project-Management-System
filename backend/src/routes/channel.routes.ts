import { Router } from 'express';
import {
  verifyJWT,
  isOrganizationAdmin,
  isOrganizationMember,
  isChannelOrgAdmin,
} from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createChannel, listChannels, deleteChannel } from '../controllers/channel.controller.js';
import {
  createChannelSchema,
  organizationChannelsParamSchema,
  channelParamSchema,
} from '../validations/channel.validation.js';

const router = Router();

router
  .route('/organizations/:organizationId/channels')
  .post(verifyJWT, isOrganizationAdmin, validate(createChannelSchema), createChannel)
  .get(verifyJWT, isOrganizationMember, validate(organizationChannelsParamSchema), listChannels);

router
  .route('/channels/:channelId')
  .delete(verifyJWT, isChannelOrgAdmin, validate(channelParamSchema), deleteChannel);

export default router;
