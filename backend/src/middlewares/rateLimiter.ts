import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 500,   // raised from 100 — normal gameplay easily exceeds 100
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests. Please try again later.',
  },
});

// Stricter limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

/**
 * Separate limiter for POST /api/analysis.
 *
 * Each call spawns Stockfish and takes 1–4 s, so the realistic throughput per
 * user is 15–60 calls/min at most.  We allow 120/min per IP (generous for
 * a single user, protective against scripted abuse) with a short 1-minute
 * window so the bucket refills quickly during normal play.
 */
export const analysisRateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Analysis rate limit reached. Please wait a moment.',
  },
});
