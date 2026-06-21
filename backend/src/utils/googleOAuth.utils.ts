import { OAuth2Client } from 'google-auth-library';
import { ApiError } from './ApiError.js';
import { env } from '../config/env.js';

export const getGoogleOAuthClient = () => {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_CALLBACK_URL;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new ApiError(
      500,
      'Missing Google OAuth env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL)',
    );
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
};
