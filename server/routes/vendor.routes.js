import { Router } from 'express';
import {
  getVendorProfile,
  updateVendorProfile,
  getPublicVendorShop,
} from '../controllers/vendor.controller.js';
import {
  getVendorOffers,
  getVendorOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
} from '../controllers/offer.controller.js';
import {
  upsertVendorRating,
  getVendorRatings,
  getCustomerRatingForVendor,
} from '../controllers/rating.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireVendor } from '../middleware/vendor.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { offerMutationLimiter } from '../middleware/rateLimit.middleware.js';
import {
  vendorProfileSchema,
  createOfferSchema,
  updateOfferSchema,
  ratingSchema,
} from '../utils/validators.js';

const router = Router();

// Public storefront route for customers
router.get('/:id/public', getPublicVendorShop);

// Ratings & reviews routes (accessible to logged-in users / customers)
router.get('/:vendorId/ratings', authenticate, getVendorRatings);
router.get(
  '/:vendorId/ratings/my-rating',
  authenticate,
  getCustomerRatingForVendor
);
router.post(
  '/:vendorId/ratings',
  authenticate,
  authorize('customer'),
  validateBody(ratingSchema),
  upsertVendorRating
);

// Apply auth & vendor resolution to private vendor dashboard routes
router.use(authenticate, authorize('vendor'), requireVendor);

// Profile routes
router.get('/profile', getVendorProfile);
router.put('/profile', validateBody(vendorProfileSchema), updateVendorProfile);

// Offer CRUD routes (rate limited to prevent spam flooding the AI validation pipeline)
router.get('/offers', getVendorOffers);
router.post(
  '/offers',
  offerMutationLimiter,
  validateBody(createOfferSchema),
  createOffer
);
router.get('/offers/:id', getVendorOfferById);
router.put(
  '/offers/:id',
  offerMutationLimiter,
  validateBody(updateOfferSchema),
  updateOffer
);
router.delete('/offers/:id', deleteOffer);

export default router;
