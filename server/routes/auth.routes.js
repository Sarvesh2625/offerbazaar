import { Router } from 'express';
import {
  signup,
  login,
  getMe,
  logout,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import { signupSchema, loginSchema } from '../utils/validators.js';

const router = Router();

// Public auth routes (rate limited)
router.post('/signup', authLimiter, validateBody(signupSchema), signup);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/logout', logout);

// Protected auth routes
router.get('/me', authenticate, getMe);

export default router;
