import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { configureCloudinary } from './config/cloudinary.js';

const PORT = process.env.PORT || 5000;

// Initialize Database & Third-Party Services
const startServer = async () => {
  try {
    // Initialize Cloudinary
    configureCloudinary();

    // Connect to MongoDB Atlas
    await connectDB();

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log(`[OfferBazaar Server] Running on http://localhost:${PORT}`);
      console.log(
        `[OfferBazaar Server] Health check at http://localhost:${PORT}/api/health`
      );
    });

    // Graceful Shutdown
    const shutdown = () => {
      console.log('\n[OfferBazaar Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[OfferBazaar Server] Closed out remaining connections.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error(
      `[OfferBazaar Server] Fatal error starting server: ${error.message}`
    );
    process.exit(1);
  }
};

startServer();
