import { userRepository } from '../repositories/users.repository.js';
import { verificationRepository } from '../repositories/verification.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { getGoogleOAuthClient } from '../utils/googleOAuth.utils.js';
import { getGravatar } from '../utils/gravatar.utils.js';
import { generateToken, hashPassword } from '../utils/security.utils.js';
import { generateAccessAndRefereshTokens } from '../utils/token.utils.js';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { Buffer } from 'node:buffer';
import {
  baseCookieOptions,
  getAccessTokenCookieOptions,
  getOAuthStateCookieOptions,
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

// Generates a cryptographically signed, timestamped state to prevent CSRF
// without depending exclusively on third-party cookies across redirects.
const generateOAuthState = (): string => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', env.ACCESS_TOKEN_SECRET)
    .update(`${nonce}:${timestamp}`)
    .digest('hex');
  return `${nonce}.${timestamp}.${signature}`;
};

// Verifies either a cryptographically signed state or a matching cookie state
const verifyOAuthState = (
  state: unknown,
  cookieState?: string,
): boolean => {
  if (!state || typeof state !== 'string') return false;

  // 1. Verify signed state
  const parts = state.split('.');
  if (parts.length === 3) {
    const nonce = parts[0];
    const timestampStr = parts[1];
    const signature = parts[2];

    if (!nonce || !timestampStr || !signature) {
      return false;
    }

    const timestamp = parseInt(timestampStr, 10);

    // Expire state after 15 minutes
    if (!isNaN(timestamp) && Date.now() - timestamp <= 15 * 60 * 1000) {
      const expectedSignature = crypto
        .createHmac('sha256', env.ACCESS_TOKEN_SECRET)
        .update(`${nonce}:${timestampStr}`)
        .digest('hex');

      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedSignature, 'hex');
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          return true;
        }
      } catch {
        // Fall through
      }
    }
  }

  // 2. Fallback to cookie comparison
  if (cookieState && state === cookieState) {
    return true;
  }

  return false;
};

export const googleAuthRedirect = async (_req: Request, res: Response) => {
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = env.GOOGLE_CALLBACK_URL;

  if (!clientId || !redirectUri) {
    throw new ApiError(500, 'Missing google oauth config');
  }

  const state = generateOAuthState();

  res.cookie('google_oauth_state', state, getOAuthStateCookieOptions());

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
  const state = generateOAuthState();

  res.cookie('github_oauth_state', state, getOAuthStateCookieOptions());

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
  const frontendUrl = (env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const { code, state, error, error_description } = req.query;

  if (error) {
    const errorMsg = (error_description as string) || (error as string) || 'GitHub authentication failed';
    return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent(errorMsg)}`);
  }

  const cookieState = req.cookies?.github_oauth_state;

  if (!code || typeof code !== 'string') {
    return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('Missing OAuth code')}`);
  }

  if (!verifyOAuthState(state, cookieState)) {
    return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('Invalid OAuth state. Please try again.')}`);
  }

  res.clearCookie('github_oauth_state', baseCookieOptions());

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

  if (user && user.authProvider !== 'github') {
    const msg =
      user.authProvider === 'local'
        ? 'You previously registered with email and password. Please log in using your password.'
        : 'You previously registered with Google. Please log in using Google.';
    return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent(msg)}`);
  }

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
    const frontendUrl = (env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent(error as string)}`);
    }

    const cookieState = req.cookies?.google_oauth_state;

    if (!code || typeof code !== 'string') {
      return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('Missing OAuth code')}`);
    }

    if (!verifyOAuthState(state, cookieState)) {
      return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('Invalid OAuth state. Please try again.')}`);
    }

    res.clearCookie('google_oauth_state', baseCookieOptions());

    const oauthClient = getGoogleOAuthClient();
    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.id_token) {
      throw new ApiError(400, 'Google did not return an id_token');
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token as string,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as GoogleProfile | undefined;

    const email = payload?.email;
    const name = payload?.name || 'User';
    const emailVerified = payload?.email_verified ?? false;

    if (!email) {
      throw new ApiError(400, 'Google account has no email');
    }

    let user = await userRepository.findByEmail(email);

    if (user && user.authProvider !== 'google') {
      const msg =
        user.authProvider === 'local'
          ? 'You previously registered with email and password. Please log in using your password.'
          : 'You previously registered with GitHub. Please log in using GitHub.';
      return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent(msg)}`);
    }

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


