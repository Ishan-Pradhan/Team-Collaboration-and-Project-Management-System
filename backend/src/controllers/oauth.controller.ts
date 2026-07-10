import { userRepository } from '../repositories/users.repository.js';
import { verificationRepository } from '../repositories/verification.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { getGoogleOAuthClient } from '../utils/googleOAuth.utils.js';
import { getGravatar } from '../utils/gravatar.utils.js';
import { generateToken, hashPassword } from '../utils/security.utils.js';
import { generateAccessAndRefereshTokens } from '../utils/token.utils.js';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../config/cookie.config.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { env } from '../config/env.js';
import {
  exchangeGithubCode,
  fetchGithubUser,
  fetchGithubPrimaryEmail,
} from '../utils/githubOAuth.utils.js';

type GoogleProfile = {
  email?: string;
  name?: string;
  email_verified?: boolean;
};

export const googleAuthRedirect = async (_req: Request, res: Response) => {
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = env.GOOGLE_CALLBACK_URL;

  if (!clientId || !redirectUri) {
    throw new ApiError(500, 'Missing google oauth config');
  }

  const state = crypto.randomBytes(16).toString('hex');

  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  return res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
};

export const githubAuthRedirect = async (
  _req: Request,
  res: Response,
) => {
  const state = crypto.randomBytes(16).toString("hex");

  res.cookie("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 5 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_CALLBACK_URL,
    scope: "user:email",
    state,
  });

  return res.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
};

export const githubAuthCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const cookieState = req.cookies?.github_oauth_state;

  if (!code || typeof code !== 'string') {
    throw new ApiError(400, 'Missing OAuth code');
  }

  if (!state || state !== cookieState) {
    throw new ApiError(400, 'Invalid OAuth state');
  }

  res.clearCookie('github_oauth_state', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  // Exchange code for access token using GitHub's REST API
  const { access_token } = await exchangeGithubCode(code);

  // Fetch user profile — parsed once, no double-consume
  const githubUser = await fetchGithubUser(access_token);

  // GitHub may return null email if the user has set it to private
  const email =
    githubUser.email ?? (await fetchGithubPrimaryEmail(access_token));

  if (!email) {
    throw new ApiError(
      400,
      'Your GitHub account has no public or verified email. Please add one in your GitHub settings.',
    );
  }

  let user = await userRepository.findByEmail(email);

  if (!user) {
    const userCount = await userRepository.count();
    const role = userCount === 0 ? 'SUPER_ADMIN' : 'USER';

    const randomPassword = generateToken();
    const hashedPassword = await hashPassword(randomPassword);

    user = await userRepository.create({
      name: githubUser.name || githubUser.login || 'User',
      email,
      passwordHash: hashedPassword,
      isVerified: true,
      authProvider: 'github',
      avatarUrl: githubUser.avatar_url,
      role,
    });
  } else {
    let updated = false;

    if (!user.avatarUrl) {
      user.avatarUrl = getGravatar(user.email);
      updated = true;
    }

    if (!user.isVerified) {
      user.isVerified = true;
      updated = true;
    }

    if (updated) await user.save();
  }

  if (!user.isActive) {
    const errorRedirectUrl = `${env.FRONTEND_URL || 'http://localhost:3000'}/auth/login?error=${encodeURIComponent('Your account has been blocked')}`;
    return res.redirect(errorRedirectUrl);
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user.id);

  const redirectUrl = env.FRONTEND_URL;

  if (redirectUrl) {
    return res
      .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
      .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions())
      .redirect(redirectUrl);
  } else {
    return res.json({
      message: 'Successfully logged in',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  }
})

export const googleAuthCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const code = req.query.code;
    const state = req.query.state;
    const cookieState = req.cookies?.google_oauth_state;

    if (!code || typeof code !== 'string') {
      throw new ApiError(400, 'Missing OAuth code');
    }

    if (!state || state !== cookieState) {
      throw new ApiError(400, 'Invalid OAuth state');
    }

    res.clearCookie('google_oauth_state', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    const oauthClient = getGoogleOAuthClient();
    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.id_token) {
      throw new ApiError(400, 'github did not return an id_token');
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token as string,
      audience: process.env.GOOGLE_CLIENT_ID as string,
    });

    const payload = ticket.getPayload() as GoogleProfile | undefined;

    const email = payload?.email;
    const name = payload?.name || 'User';
    const emailVerified = payload?.email_verified ?? false;

    if (!email) {
      throw new ApiError(400, 'Google account has no email');
    }

    let user = await userRepository.findByEmail(email);

    if (!user) {
      const userCount = await userRepository.count();
      const role = userCount === 0 ? 'SUPER_ADMIN' : 'USER';

      const randomPassword = generateToken();
      const hashedPassword = await hashPassword(randomPassword);

      user = await userRepository.create({
        name,
        email,
        passwordHash: hashedPassword,
        isVerified: Boolean(emailVerified),
        authProvider: 'google',
        avatarUrl: getGravatar(email),
        role,
      });
    } else {
      let updated = false;

      if (!user.avatarUrl) {
        user.avatarUrl = getGravatar(user.email);
      }

      if (emailVerified && !user.isVerified) {
        user.isVerified = true;
        updated = true;
      }
      if (updated) await user.save();
    }

    // If they verified via Google, cleanup any pending email-verification tokens.
    if (user.isVerified) {
      await verificationRepository.deleteEmailVerificationsForUser(user.id);
    }

    if (!user.isActive) {
      const errorRedirectUrl = `${env.FRONTEND_URL || 'http://localhost:3000'}/auth/login?error=${encodeURIComponent('Your account has been blocked')}`;
      return res.redirect(errorRedirectUrl);
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user.id,
    );

    const redirectUrl = env.FRONTEND_URL;

    if (redirectUrl) {
      return res
        .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
        .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions())
        .redirect(redirectUrl);
    }

    return res
      .status(200)
      .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
      .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions())
      .json({ success: true, message: 'Google login successful' });
  },
);


