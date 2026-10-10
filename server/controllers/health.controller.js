import { checkDbConnection } from '../config/db.js';
import { checkCloudinaryConnection } from '../config/cloudinary.js';

/**
 * Health check controller
 * Confirms both MongoDB Atlas and Cloudinary reachability
 */
export const getHealth = async (req, res) => {
  try {
    const startTime = Date.now();

    // Check DB and Cloudinary concurrently
    const [dbStatus, cloudinaryStatus] = await Promise.all([
      checkDbConnection(),
      checkCloudinaryConnection(),
    ]);

    const isHealthy =
      dbStatus.status === 'up' && cloudinaryStatus.status === 'up';

    const statusCode = isHealthy ? 200 : 200; // Return 200 with detailed status report

    return res.status(statusCode).json({
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
