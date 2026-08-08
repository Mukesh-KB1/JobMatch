import rateLimit from 'express-rate-limit';

// Blunts brute-force / credential stuffing against auth endpoints.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});
