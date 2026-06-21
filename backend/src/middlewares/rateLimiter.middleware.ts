import rateLimit from 'express-rate-limit';

export const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 1000,

  standardHeaders: true,
  legacyHeaders: false,

  skip: (req) => req.path === '/health',

  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      data: null,
      errors: null,
    });
  },
});
