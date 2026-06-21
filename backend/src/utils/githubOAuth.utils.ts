import { ApiError } from './ApiError.js';
import { env } from '../config/env.js';

export type GithubTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
};

export type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
};

export type GithubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
};

/**
 * Exchange GitHub OAuth code for an access token using GitHub's REST API.
 * GitHub does NOT use Google's OAuth2Client — it uses a plain HTTP exchange.
 */
export const exchangeGithubCode = async (
  code: string,
): Promise<GithubTokenResponse> => {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const redirectUri = env.GITHUB_CALLBACK_URL;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new ApiError(
      500,
      'Missing GitHub OAuth env vars (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL)',
    );
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new ApiError(400, 'Failed to exchange GitHub OAuth code for token');
  }

  const data = (await response.json()) as GithubTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new ApiError(400, data.error_description ?? data.error);
  }

  return data;
};

/**
 * Fetch the authenticated GitHub user's profile.
 */
export const fetchGithubUser = async (
  accessToken: string,
): Promise<GithubUser> => {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new ApiError(400, 'Failed to fetch user info from GitHub');
  }

  return response.json() as Promise<GithubUser>;
};

/**
 * Fetch verified primary email from GitHub (handles private email setting).
 * Falls back to any verified email if no primary is found.
 */
export const fetchGithubPrimaryEmail = async (
  accessToken: string,
): Promise<string | null> => {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) return null;

  const emails = (await response.json()) as GithubEmail[];

  // Prefer primary + verified
  const primary = emails.find((e) => e.primary && e.verified);
  if (primary) return primary.email;

  // Fall back to any verified
  const verified = emails.find((e) => e.verified);
  return verified?.email ?? null;
};
