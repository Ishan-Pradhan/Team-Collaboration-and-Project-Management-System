import { Router } from 'express';
import {
  verifyJWT,
  isOrganizationAdmin,
  isOrganizationMember,
  isChannelOrgAdmin,
  isChannelMember,
} from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';
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
  deleteMessage,
  uploadFile,
  listFiles,
  downloadFile,
  startDM,
  listDMs,
  muteChannel,
  listMutedChannels,
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
  messageParamSchema,
  startDMSchema,
  muteChannelSchema,
} from '../validations/channel.validation.js';

const router = Router();

router
  .route('/organizations/:organizationId/channels')
  .post(verifyJWT, isOrganizationAdmin, validate(createChannelSchema), createChannel)
  .get(verifyJWT, isOrganizationMember, validate(organizationChannelsParamSchema), listChannels);

router
  .route('/channels/muted')
  .get(verifyJWT, listMutedChannels);

router
  .route('/channels/:channelId')
  .delete(verifyJWT, isChannelOrgAdmin, validate(channelParamSchema), deleteChannel);

router
  .route('/channels/:channelId/mute')
  .patch(verifyJWT, isChannelMember, validate(muteChannelSchema), muteChannel);

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

router
  .route('/channels/:channelId/messages/:messageId')
  .delete(verifyJWT, isChannelMember, validate(messageParamSchema), deleteMessage);

router
  .route('/channels/:channelId/files')
  .get(verifyJWT, isChannelMember, validate(listMessagesSchema), listFiles)
  .post(verifyJWT, isChannelMember, validate(channelParamSchema), uploadMiddleware.single('file'), uploadFile);

router
  .route('/channels/:channelId/messages/:messageId/download')
  .get(verifyJWT, isChannelMember, validate(messageParamSchema), downloadFile);

router
  .route('/organizations/:organizationId/dms')
  .post(verifyJWT, isOrganizationMember, validate(startDMSchema), startDM)
  .get(verifyJWT, isOrganizationMember, validate(organizationChannelsParamSchema), listDMs);

export default router;
