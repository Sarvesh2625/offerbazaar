import { Router } from 'express';
import {
  getCategories,
  getActiveCategories,
} from '../controllers/category.controller.js';

const router = Router();

// GET /api/categories/active (only categories with live approved offers from active vendors)
router.get('/active', getActiveCategories);

// GET /api/categories (all seeded categories)
router.get('/', getCategories);

export default router;
