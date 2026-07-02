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
  sendMessage,
  listMessages,
  addReaction,
  removeReaction,
} from '../controllers/channel.controller.js';
import {
  createChannelSchema,
  organizationChannelsParamSchema,
  channelParamSchema,
  inviteChannelMemberSchema,
  channelMemberParamSchema,
  sendMessageSchema,
  listMessagesSchema,
  addReactionSchema,
  removeReactionSchema,
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

router
  .route('/channels/:channelId/messages')
  .get(verifyJWT, isChannelMember, validate(listMessagesSchema), listMessages)
  .post(verifyJWT, isChannelMember, validate(sendMessageSchema), sendMessage);

router
  .route('/channels/:channelId/messages/:messageId/reactions')
  .post(verifyJWT, isChannelMember, validate(addReactionSchema), addReaction);

router
  .route('/channels/:channelId/messages/:messageId/reactions/:emoji')
  .delete(verifyJWT, isChannelMember, validate(removeReactionSchema), removeReaction);

export default router;
