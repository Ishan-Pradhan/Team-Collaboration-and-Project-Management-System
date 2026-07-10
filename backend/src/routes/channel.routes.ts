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
  updateChannel,
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
  updateChannelSchema,
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

/**
 * @swagger
 * /organizations/{organizationId}/channels:
 *   post:
 *     tags: [Channels]
 *     summary: Create a channel
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string, maxLength: 100, example: general }
 *               type: { type: string, enum: [PUBLIC, PRIVATE] }
 *     responses:
 *       201:
 *         description: Channel created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Channel'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Organization admin only
 *   get:
 *     tags: [Channels]
 *     summary: List channels in an organization
 *     description: Returns public channels plus any private channels the caller is a member of.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Channels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this organization
 */
router
  .route('/organizations/:organizationId/channels')
  .post(verifyJWT, isOrganizationAdmin, validate(createChannelSchema), createChannel)
  .get(verifyJWT, isOrganizationMember, validate(organizationChannelsParamSchema), listChannels);

/**
 * @swagger
 * /channels/muted:
 *   get:
 *     tags: [Channels]
 *     summary: List channel IDs the current user has muted
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Muted channel IDs retrieved successfully
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
router
  .route('/channels/muted')
  .get(verifyJWT, listMutedChannels);

/**
 * @swagger
 * /channels/{channelId}:
 *   delete:
 *     tags: [Channels]
 *     summary: Delete a channel
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Channel deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Organization admin only
 *       404:
 *         description: Channel not found
 *   patch:
 *     tags: [Channels]
 *     summary: Rename a channel
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
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
 *               name: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Channel updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Channel'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 *       404:
 *         description: Channel not found
 */
router
  .route('/channels/:channelId')
  .delete(verifyJWT, isChannelOrgAdmin, validate(channelParamSchema), deleteChannel)
  .patch(verifyJWT, isChannelMember, validate(updateChannelSchema), updateChannel);

/**
 * @swagger
 * /channels/{channelId}/mute:
 *   patch:
 *     tags: [Channels]
 *     summary: Mute or unmute a channel for the current user
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isMuted]
 *             properties:
 *               isMuted: { type: boolean }
 *     responses:
 *       200:
 *         description: Mute state updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 */
router
  .route('/channels/:channelId/mute')
  .patch(verifyJWT, isChannelMember, validate(muteChannelSchema), muteChannel);

/**
 * @swagger
 * /channels/{channelId}/members:
 *   get:
 *     tags: [Channels]
 *     summary: List a channel's members
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Channel members retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 *   post:
 *     tags: [Channels]
 *     summary: Invite a user to a channel
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Member added to channel
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 *       404:
 *         description: User not found
 */
router
  .route('/channels/:channelId/members')
  .get(verifyJWT, isChannelMember, validate(channelParamSchema), listChannelMembers)
  .post(verifyJWT, isChannelMember, validate(inviteChannelMemberSchema), inviteChannelMember);

/**
 * @swagger
 * /channels/{channelId}/members/me:
 *   delete:
 *     tags: [Channels]
 *     summary: Leave a channel
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Left the channel successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 */
router
  .route('/channels/:channelId/members/me')
  .delete(verifyJWT, isChannelMember, validate(channelParamSchema), leaveChannel);

/**
 * @swagger
 * /channels/{channelId}/members/{userId}:
 *   delete:
 *     tags: [Channels]
 *     summary: Remove a member from a channel
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Member removed from channel
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Organization admin only
 *       404:
 *         description: Member not found
 */
router
  .route('/channels/:channelId/members/:userId')
  .delete(verifyJWT, isChannelOrgAdmin, validate(channelMemberParamSchema), removeChannelMember);

/**
 * @swagger
 * /channels/{channelId}/messages:
 *   get:
 *     tags: [Channels]
 *     summary: List messages in a channel
 *     description: Cursor-paginated, newest first.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: before
 *         schema: { type: string, format: date-time }
 *         description: Return messages older than this timestamp.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 *   post:
 *     tags: [Channels]
 *     summary: Send a text message
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, maxLength: 4000 }
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 */
router
  .route('/channels/:channelId/messages')
  .get(verifyJWT, isChannelMember, validate(listMessagesSchema), listMessages)
  .post(verifyJWT, isChannelMember, validate(sendMessageSchema), sendMessage);

/**
 * @swagger
 * /channels/{channelId}/messages/{messageId}/reactions:
 *   post:
 *     tags: [Channels]
 *     summary: Add an emoji reaction to a message
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emoji]
 *             properties:
 *               emoji: { type: string, maxLength: 64, example: 👍 }
 *     responses:
 *       201:
 *         description: Reaction added
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 *       404:
 *         description: Message not found
 */
router
  .route('/channels/:channelId/messages/:messageId/reactions')
  .post(verifyJWT, isChannelMember, validate(addReactionSchema), addReaction);

/**
 * @swagger
 * /channels/{channelId}/messages/{messageId}/reactions/{emoji}:
 *   delete:
 *     tags: [Channels]
 *     summary: Remove the current user's emoji reaction from a message
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: emoji
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reaction removed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 *       404:
 *         description: Reaction not found
 */
router
  .route('/channels/:channelId/messages/:messageId/reactions/:emoji')
  .delete(verifyJWT, isChannelMember, validate(removeReactionSchema), removeReaction);

/**
 * @swagger
 * /channels/{channelId}/messages/{messageId}:
 *   delete:
 *     tags: [Channels]
 *     summary: Delete a message
 *     description: Soft-deletes the message, replacing its content with a "message deleted" placeholder.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel, or not the message's sender
 *       404:
 *         description: Message not found
 */
router
  .route('/channels/:channelId/messages/:messageId')
  .delete(verifyJWT, isChannelMember, validate(messageParamSchema), deleteMessage);

/**
 * @swagger
 * /channels/{channelId}/files:
 *   get:
 *     tags: [Channels]
 *     summary: List files shared in a channel
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: before
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 *   post:
 *     tags: [Channels]
 *     summary: Upload a file to a channel
 *     description: Uploads to Cloudinary and posts a FILE-type message in the channel.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: No file uploaded, or file rejected by upload validation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 */
router
  .route('/channels/:channelId/files')
  .get(verifyJWT, isChannelMember, validate(listMessagesSchema), listFiles)
  .post(verifyJWT, isChannelMember, validate(channelParamSchema), uploadMiddleware.single('file'), uploadFile);

/**
 * @swagger
 * /channels/{channelId}/messages/{messageId}/download:
 *   get:
 *     tags: [Channels]
 *     summary: Download a file message's attachment
 *     description: Proxies the file from Cloudinary with a Content-Disposition attachment header, so channel membership is enforced on every download.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: File stream
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this channel
 *       404:
 *         description: File message not found
 */
router
  .route('/channels/:channelId/messages/:messageId/download')
  .get(verifyJWT, isChannelMember, validate(messageParamSchema), downloadFile);

/**
 * @swagger
 * /organizations/{organizationId}/dms:
 *   post:
 *     tags: [Channels]
 *     summary: Start (or resume) a direct message with another organization member
 *     description: Idempotent — returns the existing DM channel if one already exists between the two users.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: DM channel created or resumed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Channel'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this organization
 *       404:
 *         description: Target user not found
 *   get:
 *     tags: [Channels]
 *     summary: List the current user's direct message channels in an organization
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: DM channels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this organization
 */
router
  .route('/organizations/:organizationId/dms')
  .post(verifyJWT, isOrganizationMember, validate(startDMSchema), startDM)
  .get(verifyJWT, isOrganizationMember, validate(organizationChannelsParamSchema), listDMs);

export default router;
