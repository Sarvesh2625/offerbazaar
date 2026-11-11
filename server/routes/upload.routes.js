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
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB per image (stays under the platform body limit)
    files: 3,
  },
});

// Protect upload endpoints
router.post('/sign', authenticate, getUploadSignature);
router.post('/', authenticate, upload.array('images', 3), uploadImages);

export default router;
