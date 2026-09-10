import type { CookieOptions } from 'express';
import { parseTimeToMs } from '../utils/parseTime.utils.js';
import { env } from './env.js';

const isProduction = env.NODE_ENV === 'production';

// Set COOKIE_SAMESITE=lax when the API and frontend share a registrable domain
// (api.example.com + app.example.com). The session cookie is then first-party, and
// Lax keeps it off cross-site requests — CORS blocks an attacker from reading a
// response, but not from making the request, so None leaves us open to CSRF.
//
// The default of None is what a cross-site deployment (different domains) requires,
// but it makes the session a third-party cookie: Safari blocks those and Brave
// partitions them per top-level site, so the cookie set on the OAuth callback
// redirect is invisible to the frontend's later requests and login silently fails.
//
// Lax still permits OAuth: the provider's callback is a top-level GET navigation.
const defaultSameSite = isProduction ? 'none' : 'lax';

export const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: env.COOKIE_SAMESITE ?? defaultSameSite,
  domain: env.COOKIE_DOMAIN || undefined,
});

export const getRefreshTokenCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  maxAge: parseTimeToMs(env.REFRESH_TOKEN_EXPIRES_IN as string),
});

export const getAccessTokenCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  maxAge: parseTimeToMs(env.ACCESS_TOKEN_EXPIRES_IN as string),
});

// The OAuth state cookie is set before redirecting to the provider and read back
// when the provider redirects to our callback — a cross-site top-level GET, which
// Lax permits.
export const getOAuthStateCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  maxAge: 5 * 60 * 1000,
});
