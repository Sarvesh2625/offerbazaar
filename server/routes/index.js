import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import vendorRoutes from './vendor.routes.js';
import categoryRoutes from './category.routes.js';
import uploadRoutes from './upload.routes.js';
import adminRoutes from './admin.routes.js';
import offerRoutes from './offer.routes.js';

const router = Router();

// Mount modular routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/vendor', vendorRoutes);
router.use('/vendors', vendorRoutes);
router.use('/categories', categoryRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);
router.use('/offers', offerRoutes);

export default router;
