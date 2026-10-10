import { Router } from 'express';
import multer from 'multer';
import {
  getUploadSignature,
  uploadImages,
} from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per image
});

// Protect upload endpoints
router.post('/sign', authenticate, getUploadSignature);
router.post('/', authenticate, upload.array('images', 5), uploadImages);

export default router;
