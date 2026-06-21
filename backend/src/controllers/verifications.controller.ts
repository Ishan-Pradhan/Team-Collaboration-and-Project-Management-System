import { userRepository } from '../repositories/users.repository.js';
import { verificationRepository } from '../repositories/verification.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { generateToken } from '../utils/security.utils.js';
import { generateAccessAndRefereshTokens } from '../utils/token.utils.js';
import type { Request, Response } from 'express';
import { sendVerificationEmail } from '../services/email.service.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { env } from '../config/env.js';
import { sendAuthResponse } from '../utils/sendVerificationResponse.utils.js';
import { TWENTY_FOUR_HOURS_IN_MS } from '../constants/index.js';

// VERIFY EMAIL
export const verifyEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const token = req.query.token as string | undefined;

    if (!token) {
      throw new ApiError(400, 'Verification token is required');
    }

    const verification =
      await verificationRepository.findEmailVerificationByToken(token);

    if (!verification) {
      throw new ApiError(400, 'Invalid verification token');
    }

    if (new Date(verification.expiresAt).getTime() < Date.now()) {
      await verificationRepository.deleteById(verification.id);
      throw new ApiError(400, 'Verification token expired');
    }

    const user = await userRepository.findById(verification.userId);

    if (!user) {
      await verificationRepository.deleteById(verification.id);
      throw new ApiError(404, 'User not found');
    }

    const redirectUrl = `${env.FRONTEND_URL?.replace(/\/$/, '')}/verify-success`;

    // idempotent update
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    await verificationRepository.deleteEmailVerificationsForUser(user.id);

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user.id,
    );

    sendAuthResponse({
      res,
      accessToken,
      refreshToken,
      redirectUrl,
      message: user.isVerified
        ? 'Email verified successfully'
        : 'Email already verified',
    });
  },
);

// RESEND VERIFICATION EMAIL
export const resendVerificationEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const email = (req.body as { email?: unknown })?.email;

    if (!email || typeof email !== 'string') {
      throw new ApiError(400, 'Email is required');
    }

    const user = await userRepository.findByEmail(email);

    if (!user || user.isVerified) {
      res.status(200).json({
        success: true,
        message:
          'If an account exists for this email, a verification link has been sent.',
      });
      return;
    }

    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS_IN_MS);

    await verificationRepository.deleteEmailVerificationsForUser(user?.id);
    await verificationRepository.createEmailVerification(
      user?.id,
      verificationToken,
      expiresAt,
    );

    let verifyLink: string | undefined;

    try {
      const result = await sendVerificationEmail(
        user?.email,
        verificationToken,
      );
      verifyLink = result.verifyLink;
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
    }

    res.status(200).json({
      success: true,
      message:
        'If an account exists for this email, a verification link has been sent.',
      ...(process.env.NODE_ENV === 'development' && verifyLink
        ? { verifyLink }
        : {}),
    });
  },
);
