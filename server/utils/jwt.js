import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.JWT_SECRET || 'offerbazaar_super_secret_jwt_key_2026!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT containing userId and role
 * @param {Object} user - User document or object with _id/id and role
 * @returns {string} - Signed JWT
 */
export const generateToken = (user) => {
  const userId = user._id ? user._id.toString() : user.id;
  return jwt.sign({ userId, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verify a JWT and return the decoded payload
 * @param {string} token - The JWT string
 * @returns {Object} - Decoded payload { userId, role, ... }
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Cookie attributes for the httpOnly auth cookie.
 *
 * The frontend reaches the API through the Vercel rewrite proxy, so the
 * browser only ever talks to its own origin and the cookie is a first-party
 * cookie. `SameSite=Strict` is therefore correct (and CSRF-safe) for the
 * single-domain deployment.
 *
 * Set `COOKIE_SAMESITE=none` when the API is consumed from a genuinely
 * cross-site origin (for example a separate API domain called directly from
 * the browser). `none` requires the `Secure` flag, hence HTTPS.
 */
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = (process.env.COOKIE_SAMESITE || 'strict').toLowerCase();

  const validSameSite = ['strict', 'lax', 'none'];
  const resolvedSameSite = validSameSite.includes(sameSite)
    ? sameSite
    : 'strict';

  return {
    httpOnly: true,
    secure: isProduction || resolvedSameSite === 'none',
    sameSite: resolvedSameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
};

/**
 * Set httpOnly auth cookie on HTTP response
 * @param {Object} res - Express response object
 * @param {string} token - Signed JWT
 */
export const setAuthCookie = (res, token) => {
  res.cookie('token', token, getCookieOptions());
};

/**
 * Clear the auth cookie on HTTP response
 * @param {Object} res - Express response object
 */
export const clearAuthCookie = (res) => {
  const options = getCookieOptions();
  delete options.maxAge;
  res.clearCookie('token', options);
};
