import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../config/cookie.config.js';
import { env } from '../config/env.js';
import { ONE_HOUR_IN_MS, TWENTY_FOUR_HOURS_IN_MS } from '../constants/index.js';
import { userRepository } from '../repositories/users.repository.js';
import { verificationRepository } from '../repositories/verification.repository.js';
import { buildVerifyLink } from '../services/email.service.js';
import { queueService } from '../services/queue.service.js';
import type {
  AuthRequest,
  LoginUserTypes,
  RegisterUserTypes,
} from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { getGravatar } from '../utils/gravatar.utils.js';
import {
  comparePassword,
  generateToken,
  hashPassword,
} from '../utils/security.utils.js';
import { generateAccessAndRefereshTokens } from '../utils/token.utils.js';
import type { Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { uploadToCloudinary } from '../services/cloudinary.service.js';

// REGISTER
export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, email, password } = req.body as RegisterUserTypes;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, 'Email already exists');
    }

    const hashedPassword = await hashPassword(password);

    const userCount = await userRepository.count();
    const role = userCount === 0 ? 'SUPER_ADMIN' : 'USER';

    const newUser = await userRepository.create({
      name,
      email,
      passwordHash: hashedPassword,
      avatarUrl: getGravatar(email),
      role,
    });

    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS_IN_MS);
    await verificationRepository.deleteEmailVerificationsForUser(newUser.id);
    await verificationRepository.createEmailVerification(
      newUser.id,
      verificationToken,
      expiresAt,
    );

    let verificationEmailSent = false;
    const verifyLink = buildVerifyLink(verificationToken);

    try {
      await queueService.enqueueVerificationEmail({
        to: newUser.email,
        token: verificationToken,
      });
      verificationEmailSent = true;
    } catch (emailError) {
      console.error('Failed to queue verification email:', emailError);
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      newUser.id,
    );

    return res
      .status(201)
      .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
      .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions())
      .json({
        success: true,
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          avatarUrl: newUser.avatarUrl,
          verificationEmailSent,
          ...(process.env.NODE_ENV === 'development' && verifyLink
            ? { verifyLink }
            : {}),
        },
        message: verificationEmailSent
          ? 'User registered successfully. Verification email sent.'
          : 'User registered successfully. Verification email could not be sent.',
      });
  },
);

// LOGIN
export const loginUser = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const { email, password } = req.body as LoginUserTypes;

    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required');
    }

    const user = await userRepository.findByEmailWithPassword(email);

    if (!user) {
      throw new ApiError(400, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Your account has been blocked');
    }

    if (!user.isVerified) {
      throw new ApiError(
        403,
        'Your account is not verified. Please verify your email',
      );
    }

    if (user.authProvider === 'google') {
      throw new ApiError(
        400,
        'You previously signed in with Google. Please use Google login.',
      );
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid user credentials');
    }

    if (!user.avatarUrl) {
      user.avatarUrl = getGravatar(user.email);
      await user.save();
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user.id,
    );

    return res
      .status(200)
      .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
      .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions())
      .json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
        message: 'Login Successful',
      });
  },
);

// LOGOUT
export const logoutUser = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const accessToken = req.cookies.accessToken;

    if (accessToken) {
      try {
        const decoded = jwt.verify(
          accessToken,
          process.env.ACCESS_TOKEN_SECRET as string,
        ) as { id: string };

        const user = await userRepository.findByIdWithSecrets(decoded.id);

        if (user) {
          user.refreshToken = null;
          await user.save();
        }
      } catch { }
    }

    return res
      .clearCookie('accessToken', getAccessTokenCookieOptions())
      .clearCookie('refreshToken', getRefreshTokenCookieOptions())
      .json({
        success: true,
        message: 'Logged out successfully',
      });
  },
);

// REFRESH ACCESS TOKEN
export const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new ApiError(401, 'Unauthorized: No refresh token provided');
    }
    let decoded: JwtPayload & { id: string };

    try {
      decoded = jwt.verify(
        refreshToken,
        env.REFRESH_TOKEN_SECRET as string,
      ) as JwtPayload & { id: string };
    } catch (error) {
      throw new ApiError(401, 'Unauthorized: Invalid refresh token');
    }

    const user = await userRepository.findByIdWithSecrets(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, 'Unauthorized: Invalid refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefereshTokens(user.id);

    return res
      .status(200)
      .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
      .cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions())
      .json({
        success: true,
        data: user,
        message: 'Token refreshed successfully',
      });
  },
);

// CHANGE PASSWORD (AUTHENTICATED)
export const changePassword = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user?.id;

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    if (!currentPassword || !newPassword) {
      throw new ApiError(400, 'Current password and new password are required');
    }

    const user = await userRepository.findByIdWithSecrets(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);

    if (!isMatch) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return ok(res, null, 'Password changed successfully');
  },
);

// UPDATE PROFILE (name, bio, jobTitle)
export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) throw new ApiError(401, 'Unauthorized');

    const { name, bio, jobTitle } = req.body as { name?: string; bio?: string; jobTitle?: string };
    if (!name || !name.trim()) throw new ApiError(400, 'Name is required');

    const updated = await userRepository.update(userId, {
      name: name.trim(),
      ...(bio !== undefined && { bio: bio.trim() || null }),
      ...(jobTitle !== undefined && { jobTitle: jobTitle.trim() || null }),
    });
    if (!updated) throw new ApiError(404, 'User not found');

    return ok(res, {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      jobTitle: updated.jobTitle,
    }, 'Profile updated successfully');
  }
);

// UPLOAD AVATAR
export const uploadAvatar = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) throw new ApiError(401, 'Unauthorized');

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) throw new ApiError(400, 'No image file provided');

    if (!file.mimetype.startsWith('image/')) {
      throw new ApiError(400, 'Only image files are allowed for avatars');
    }

    const uploaded = await uploadToCloudinary(file.buffer, {
      folder: 'avatars',
      resourceType: 'image',
    });

    const updated = await userRepository.update(userId, { avatarUrl: uploaded.url });
    if (!updated) throw new ApiError(404, 'User not found');

    return ok(res, {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
    }, 'Avatar updated successfully');
  }
);

// FORGOT PASSWORD (PUBLIC)
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const { email } = req.body as { email?: unknown };

    if (!email || typeof email !== 'string') {
      throw new ApiError(400, 'Email is required');
    }
    const user = await userRepository.findByEmail(email);

    if (!user || user.authProvider === 'google') {
      return ok(res, null, 'If the account exists, a reset link was sent.');
    }

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + ONE_HOUR_IN_MS);

    await verificationRepository.deletePasswordResetTokensForUser(user.id);
    await verificationRepository.createPasswordResetToken(
      user.id,
      resetToken,
      expiresAt,
    );

    try {
      await queueService.enqueuePasswordResetEmail({
        to: user.email,
        token: resetToken,
      });
    } catch (emailErr) {
      console.error('Failed to queue password reset email', emailErr);
    }

    return ok(
      res,
      null,
      'If an account exists for this email, a password reset link has been sent.',
    );
  },
);

// RESET PASSWORD (PUBLIC)
export const resetPassword = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const { token, newPassword } = req.body as {
      token?: string;
      newPassword?: string;
    };

    if (!token || typeof token !== 'string') {
      throw new ApiError(400, 'Reset token is required');
    }

    if (
      !newPassword ||
      typeof newPassword !== 'string' ||
      newPassword.length < 6
    ) {
      throw new ApiError(400, 'New password must be at least 6 characters');
    }

    const record = await verificationRepository.findPasswordResetByToken(token);

    if (!record) {
      throw new ApiError(400, 'Invalid or expired reset token');
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await verificationRepository.deleteById(record.id);
      throw new ApiError(400, 'Reset token has expired');
    }

    const user = await userRepository.findById(record.userId);

    if (!user) {
      await verificationRepository.deleteById(record.id);
      throw new ApiError(404, 'User not found');
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    await verificationRepository.deletePasswordResetTokensForUser(user.id);

    return ok(res, null, 'Password has been reset');
  },
);
