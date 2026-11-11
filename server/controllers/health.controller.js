import { checkDbConnection, connectDB } from '../config/db.js';
import { checkCloudinaryConnection } from '../config/cloudinary.js';

/**
 * Health check controller
 * Confirms both MongoDB Atlas and Cloudinary reachability
 */
export const getHealth = async (req, res) => {
  try {
    const startTime = Date.now();

    // Best effort connection attempt so a cold-started function reports an
    // accurate status instead of "disconnected".
    await connectDB().catch(() => null);

    // Check DB and Cloudinary concurrently
    const [dbStatus, cloudinaryStatus] = await Promise.all([
      checkDbConnection(),
      checkCloudinaryConnection(),
    ]);

    const isHealthy =
      dbStatus.status === 'up' && cloudinaryStatus.status === 'up';

    // Always answer 200 so the platform/probe sees a structured report.
    return res.status(200).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      responseTimeMs: Date.now() - startTime,
      services: {
        database: dbStatus,
        cloudinary: cloudinaryStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Failed to execute health check',
      error: error.message,
    });
  }
};
