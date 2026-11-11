import mongoose from 'mongoose';

/**
 * Cached MongoDB connection for serverless (Vercel) environments.
 *
 * On Vercel each function instance is reused across invocations, but a new
 * instance is created on cold start. Without caching, every cold start opens
 * a brand new connection pool, which quickly exhausts the MongoDB Atlas
 * connection limit (cluster-wide) and slows down the first request of every
 * instance.
 *
 * The connection promise is stored on `globalThis` so it survives module
 * re-evaluation across warm invocations of the same instance.
 */
const globalForMongoose = globalThis;

const CONNECT_OPTIONS = {
  // Serverless-safe pooling: keep the pool small so a single instance cannot
  // exhaust the cluster's connection limit when many instances scale out.
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  // Fail fast instead of buffering commands for 10s when the DB is unreachable.
  bufferCommands: false,
};

/**
 * Connect to MongoDB Atlas (idempotent, safe to call on every request)
 * @returns {Promise<import('mongoose').Connection>}
 */
export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      'MONGO_URI is not defined. Add it to server/.env or the Vercel project environment variables.'
    );
  }

  // Already connected (warm invocation) -> reuse the existing connection.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Connection in flight or already established on this instance -> reuse it.
  if (!globalForMongoose.__offerBazaarMongoPromise) {
    globalForMongoose.__offerBazaarMongoPromise = mongoose
      .connect(mongoUri, CONNECT_OPTIONS)
      .then((conn) => {
        console.log(`[DB] MongoDB Connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        // Allow a subsequent request to retry the connection.
        globalForMongoose.__offerBazaarMongoPromise = undefined;
        throw error;
      });
  }

  try {
    return await globalForMongoose.__offerBazaarMongoPromise;
  } catch (error) {
    console.error(`[DB] Error connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

/**
 * Middleware that guarantees the database connection is established before a
 * request touches any Mongoose model. Required on serverless platforms where
 * the module scope is evaluated without an active connection.
 *
 * In the test environment the connection is managed by the test suite, so
 * this middleware must never open (or switch to) another connection.
 *
 * @type {import('express').RequestHandler}
 */
export const ensureDbConnection = async (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  try {
    await connectDB();
    next();
  } catch (error) {
    console.error(`[DB] Request aborted, DB unavailable: ${error.message}`);
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable, please retry shortly.',
    });
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
