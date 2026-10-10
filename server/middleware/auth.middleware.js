import { verifyToken } from '../utils/jwt.js';

/**
 * Middleware to authenticate requests using JWT from Authorization header or httpOnly cookie
 */
export const authenticate = (req, res, next) => {
  let token = null;

  // 1. Check Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    // 2. Fallback to httpOnly cookie
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required: No token provided',
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed: Invalid or expired token',
      error: error.message,
    });
  }
};

/**
 * Middleware to authorize access based on user role
 * @param  {...string} allowedRoles - List of authorized roles (e.g. 'admin', 'vendor', 'customer')
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};
