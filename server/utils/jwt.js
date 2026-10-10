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
 * Set httpOnly auth cookie on HTTP response
 * @param {Object} res - Express response object
 * @param {string} token - Signed JWT
 */
export const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
    maxAge,
  });
};

/**
 * Clear the auth cookie on HTTP response
 * @param {Object} res - Express response object
 */
export const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  });
};
