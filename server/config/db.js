import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas
 */
export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn(
      '[DB] Warning: MONGO_URI is not defined in environment variables.'
    );
    return;
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[DB] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[DB] Error connecting to MongoDB: ${error.message}`);
  }
};

/**
 * Check MongoDB connection status and reachability
 * @returns {Promise<{status: string, message: string, readyState: number}>}
 */
export const checkDbConnection = async () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const readyState = mongoose.connection.readyState;
  const stateStr = states[readyState] || 'unknown';

  if (readyState !== 1) {
    return {
      status: 'down',
      message: `Database is currently ${stateStr}`,
      readyState,
    };
  }

  try {
    // Ping the database to verify active roundtrip connectivity
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'up',
        message: 'MongoDB Atlas is connected and reachable',
        readyState,
      };
    }

    return {
      status: 'up',
      message: 'MongoDB is connected (readyState 1)',
      readyState,
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: `Database ping failed: ${error.message}`,
      readyState,
    };
  }
};
