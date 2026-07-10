import rateLimit from 'express-rate-limit';

const rateLimitHandler: import('express-rate-limit').Options['handler'] = (_req, res) => {
  return res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
    data: null,
    errors: null,
  });
};

// Blanket safety net across the whole API.
export const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 1000,

  standardHeaders: true,
  legacyHeaders: false,

  skip: (req) => req.path === '/health',

  handler: rateLimitHandler,
});

// Register, resend-verification, and forgot-password are unauthenticated
// and each queue an email through Resend. Without a tight limit here,
// scripted abuse can blow through Resend's daily/monthly send quota (which
// is shared by every user of the app, including real signups) long before
// the blanket `limiter` above would ever trip.
export const authEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AUTH_EMAIL_RATE_LIMIT_MAX) || 5,

  standardHeaders: true,
  legacyHeaders: false,

  handler: rateLimitHandler,
});

// Brute-force protection on login — independent of the email quota concern
// above, but the same shared limiter infrastructure.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 20,

  standardHeaders: true,
  legacyHeaders: false,

  handler: rateLimitHandler,
});

// Organization invites are authenticated (admin-only) but still send email
// per call, so a compromised or careless admin session shouldn't be able to
// exhaust the shared Resend quota either.
export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.INVITE_RATE_LIMIT_MAX) || 30,

  standardHeaders: true,
  legacyHeaders: false,

  handler: rateLimitHandler,
});
