import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import vendorRoutes from './vendor.routes.js';
import categoryRoutes from './category.routes.js';
import uploadRoutes from './upload.routes.js';
import adminRoutes from './admin.routes.js';
import offerRoutes from './offer.routes.js';
import { ensureDbConnection } from '../config/db.js';

const router = Router();

// Health check is mounted first and does not require a live database
// connection, so the health endpoint stays reachable even when MongoDB is
// temporarily unavailable (it reports the degraded status in its payload).
router.use('/health', healthRoutes);

// Every other route needs the database. On serverless platforms the
// connection is established lazily and then cached on the function instance,
// so warm invocations reuse the existing pool.
router.use(ensureDbConnection);

// Mount modular routes
router.use('/auth', authRoutes);
router.use('/vendor', vendorRoutes);
router.use('/vendors', vendorRoutes);
router.use('/categories', categoryRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);
router.use('/offers', offerRoutes);

export default router;
