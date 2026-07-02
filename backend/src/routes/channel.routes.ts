import { Router } from 'express';
import {
  verifyJWT,
  isOrganizationAdmin,
  isOrganizationMember,
  isChannelOrgAdmin,
  isChannelMember,
} from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createChannel,
  listChannels,
  deleteChannel,
  listChannelMembers,
  inviteChannelMember,
  leaveChannel,
  removeChannelMember,
} from '../controllers/channel.controller.js';
import {
  createChannelSchema,
  organizationChannelsParamSchema,
  channelParamSchema,
  inviteChannelMemberSchema,
  channelMemberParamSchema,
} from '../validations/channel.validation.js';

const router = Router();

router
  .route('/organizations/:organizationId/channels')
  .post(verifyJWT, isOrganizationAdmin, validate(createChannelSchema), createChannel)
  .get(verifyJWT, isOrganizationMember, validate(organizationChannelsParamSchema), listChannels);

router
  .route('/channels/:channelId')
  .delete(verifyJWT, isChannelOrgAdmin, validate(channelParamSchema), deleteChannel);

router
  .route('/channels/:channelId/members')
  .get(verifyJWT, isChannelMember, validate(channelParamSchema), listChannelMembers)
  .post(verifyJWT, isChannelMember, validate(inviteChannelMemberSchema), inviteChannelMember);

router
  .route('/channels/:channelId/members/me')
  .delete(verifyJWT, isChannelMember, validate(channelParamSchema), leaveChannel);

router
  .route('/channels/:channelId/members/:userId')
  .delete(verifyJWT, isChannelOrgAdmin, validate(channelMemberParamSchema), removeChannelMember);

export default router;
