import { Router } from 'express';
import {
  getCustomerOffers,
  searchOffers,
  getPublicOfferById,
} from '../controllers/publicOffer.controller.js';

const router = Router();

// Public customer-facing offer discovery and search (only active vendors, approved status)
router.get('/search', searchOffers);
router.get('/:id', getPublicOfferById);
router.get('/', getCustomerOffers);

export default router;
