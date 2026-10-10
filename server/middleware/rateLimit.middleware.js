import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login & signup).
 * Prevents brute force credential attacks and automated account spam.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // In test environment, allow explicit testing via test header, otherwise allow test runs to pass
    if (process.env.NODE_ENV === 'test') {
      return req.headers['x-test-rate-limit'] ? 3 : 500;
    }
    return 10; // 10 attempts per 15 mins in production/dev
  },
  keyGenerator: (req) => req.headers['x-test-client-ip'] || req.ip,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many authentication attempts, please try again after 15 minutes.',
  },
});

/**
 * Rate limiter for offer creation and modification endpoints.
 * Prevents spam offer submissions flooding the automated LLM validation pipeline.
 */
export const offerMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    if (process.env.NODE_ENV === 'test') {
      return req.headers['x-test-rate-limit'] ? 3 : 500;
    }
    return 30; // 30 offer submissions/edits per 15 mins
  },
  keyGenerator: (req) => req.headers['x-test-client-ip'] || req.ip,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many offer submissions from this IP, please try again later.',
  },
});
