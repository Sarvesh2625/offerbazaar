import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  reviewDecisionSchema,
  vendorStatusSchema,
  takedownSchema,
} from '../utils/validators.js';
import {
  getReviewQueue,
  submitReviewDecision,
  getVendors,
  updateVendorStatus,
  getAnalytics,
  getLiveOffers,
  takeDownOffer,
} from '../controllers/admin.controller.js';

const router = Router();

// Protect all admin endpoints with authenticate and authorize('admin')
router.use(authenticate, authorize('admin'));

// Review Queue endpoints
router.get('/review-queue', getReviewQueue);
router.post(
  '/review-queue/:id/decision',
  validateBody(reviewDecisionSchema),
  submitReviewDecision
);

// Live Offers endpoints (Approved offers management & manual takedown)
router.get('/live-offers', getLiveOffers);
router.post(
  '/live-offers/:id/takedown',
  validateBody(takedownSchema),
  takeDownOffer
);
router.post(
  '/offers/:id/takedown',
  validateBody(takedownSchema),
  takeDownOffer
);

// Vendor Management endpoints
router.get('/vendors', getVendors);
router.put(
  '/vendors/:id/status',
  validateBody(vendorStatusSchema),
  updateVendorStatus
);

// Analytics endpoint
router.get('/analytics', getAnalytics);

export default router;
