import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Resolves the client identity used as the rate limit key.
 *
 * IMPORTANT: `x-test-client-ip` is a test-only escape hatch. It is honoured
 * exclusively when NODE_ENV === 'test' because a client-supplied header must
 * never be able to influence production rate limiting (it would allow a
 * complete bypass of the limit by rotating the header).
 *
 * `ipKeyGenerator` normalises IPv6 addresses to their /56 subnet so that a
 * single IPv6 user cannot trivially bypass the limit by rotating addresses
 * within their prefix.
 */
const buildKeyGenerator = () => {
  return (req) => {
    if (process.env.NODE_ENV === 'test') {
      const testIp = req.headers['x-test-client-ip'];
      if (testIp) return String(testIp);
    }
    return ipKeyGenerator(req.ip);
  };
};

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
  keyGenerator: buildKeyGenerator(),
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
  keyGenerator: buildKeyGenerator(),
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many offer submissions from this IP, please try again later.',
  },
});
