import { Router } from 'express';
import { getCurrentUser } from '../controllers/users.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  loginSchema,
  refreshAccessTokenSchema,
  registerSchema,
  resendVerificationEmailSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validations/auth.validation.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';
import { authEmailLimiter, loginLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  uploadAvatar,
} from '../controllers/auth.controller.js';
import {
  githubAuthCallback,
  githubAuthRedirect,
  googleAuthCallback,
  googleAuthRedirect,
} from '../controllers/oauth.controller.js';
import {
  resendVerificationEmail,
  verifyEmail,
} from '../controllers/verifications.controller.js';

const router = Router();

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: Creates a new user account and sends a verification email. The first user registered becomes an admin.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: secret123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     avatarUrl: { type: string, nullable: true }
 *                     verificationEmailSent: { type: boolean }
 *       400:
 *         description: Email already exists or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.route('/register').post(authEmailLimiter, validate(registerSchema), registerUser);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful — sets accessToken and refreshToken cookies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Login Successful }
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       400:
 *         description: Invalid credentials or unverified account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account blocked or not verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.route('/login').post(loginLimiter, validate(loginSchema), loginUser);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current user
 *     description: Clears access and refresh token cookies and invalidates the server-side refresh token.
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.route('/logout').post(logoutUser);

/**
 * @swagger
 * /auth/current-user:
 *   get:
 *     tags: [Auth]
 *     summary: Get the currently authenticated user
 *     responses:
 *       200:
 *         description: Current user data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.route('/current-user').get(verifyJWT, getCurrentUser);

/**
 * @swagger
 * /auth/refresh-access-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh the access token using the refresh token cookie
 *     security: []
 *     description: Reads the `refreshToken` cookie and issues a new access token + refresh token pair.
 *     responses:
 *       200:
 *         description: Token refreshed — new cookies are set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Invalid or missing refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router
  .route('/refresh-access-token')
  .post(validate(refreshAccessTokenSchema), refreshAccessToken);

// ─────────────────────────────────────────────────────────────
// EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     tags: [Email Verification]
 *     summary: Verify email address via token
 *     description: Validates the one-time token from the verification email and marks the user as verified. Redirects to the frontend on success.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The verification token sent by email
 *     responses:
 *       302:
 *         description: Redirects to /verify-success on the frontend
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.route('/verify-email').get(validate(verifyEmailSchema), verifyEmail);

/**
 * @swagger
 * /auth/resend-verification-email:
 *   post:
 *     tags: [Email Verification]
 *     summary: Resend email verification link
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *     responses:
 *       200:
 *         description: Verification email sent (or silently skipped if already verified)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router
  .route('/resend-verification-email')
  .post(authEmailLimiter, validate(resendVerificationEmailSchema), resendVerificationEmail);

// ─────────────────────────────────────────────────────────────
// PASSWORD
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Password]
 *     summary: Request a password reset link
 *     description: Sends a reset link to the email if an account exists. Always returns 200 to prevent user enumeration.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *     responses:
 *       200:
 *         description: Reset link sent (or silently skipped if no account)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router
  .route('/forgot-password')
  .post(authEmailLimiter, validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Password]
 *     summary: Reset password using a reset token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token received in the reset email
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: newsecret456
 *     responses:
 *       200:
 *         description: Password has been reset
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router
  .route('/reset-password')
  .post(validate(resetPasswordSchema), resetPassword);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     tags: [Password]
 *     summary: Change password (authenticated)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: secret123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: newsecret456
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Current password incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router
  .route('/change-password')
  .post(verifyJWT, validate(changePasswordSchema), changePassword);

/**
 * @swagger
 * /auth/profile:
 *   patch:
 *     tags: [Auth]
 *     summary: Update profile name
 *     security:
 *       - cookieAuth: []
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
 *     responses:
 *       200:
 *         description: Profile updated successfully
 * /auth/profile/avatar:
 *   patch:
 *     tags: [Auth]
 *     summary: Upload a new avatar image
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 */
router.patch('/profile', verifyJWT, validate(updateProfileSchema), updateProfile);
router.patch('/profile/avatar', verifyJWT, uploadMiddleware.single('file'), uploadAvatar);

// ─────────────────────────────────────────────────────────────
// OAUTH
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/google:
 *   get:
 *     tags: [OAuth]
 *     summary: Redirect to Google OAuth consent screen
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to Google
 */
router.route('/google').get(googleAuthRedirect);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     tags: [OAuth]
 *     summary: Google OAuth callback
 *     description: Google redirects here after consent. Sets auth cookies and redirects to the frontend.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *         description: Authorization code from Google
 *     responses:
 *       302:
 *         description: Redirects to frontend with auth cookies set
 *       400:
 *         description: OAuth error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.route('/google/callback').get(googleAuthCallback);

/**
 * @swagger
 * /auth/github:
 *   get:
 *     tags: [OAuth]
 *     summary: Redirect to GitHub OAuth consent screen
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to GitHub
 */
router.route('/github').get(githubAuthRedirect);

/**
 * @swagger
 * /auth/github/callback:
 *   get:
 *     tags: [OAuth]
 *     summary: GitHub OAuth callback
 *     description: GitHub redirects here after consent. Sets auth cookies and redirects to the frontend.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *         description: Authorization code from GitHub
 *     responses:
 *       302:
 *         description: Redirects to frontend with auth cookies set
 *       400:
 *         description: OAuth error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.route('/github/callback').get(githubAuthCallback);

// Aliases (in case Google Console redirect URI uses /oauth/google/*)
router.route('/oauth/google').get(googleAuthRedirect);
router.route('/oauth/google/callback').get(googleAuthCallback);
router.route('/oauth/github').get(githubAuthRedirect);
router.route('/oauth/github/callback').get(githubAuthCallback);

export default router;
