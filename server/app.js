import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import routes from './routes/index.js';
import { notFound } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { configureCloudinary } from './config/cloudinary.js';

const app = express();

// Configure the Cloudinary SDK as soon as the app is loaded so that every
// code path (including the health check and direct uploads) can use it.
configureCloudinary();

/**
 * Vercel (and most reverse proxies) forward the real client IP via
 * X-Forwarded-For. Without `trust proxy` Express reports the proxy's IP for
 * every request, which makes IP based rate limiting treat all users as one
 * single client. `1` trusts exactly one hop (the platform proxy) and is safe:
 * a client cannot spoof X-Forwarded-For beyond that single trusted hop.
 */
app.set('trust proxy', 1);

/**
 * Vercel Function configuration.
 * The automated offer validation pipeline calls an LLM, a geocoder and a
 * vision API in parallel; 60s is enough headroom while staying well inside
 * the platform limit.
 */
export const config = {
  maxDuration: 60,
};

// Security HTTP Headers
app.use(helmet());

/**
 * Cross-Origin Resource Sharing.
 *
 * The browser talks to a single origin (the frontend), and Vercel's rewrite
 * proxy forwards `/api/*` to this backend server-side. Because of that the
 * browser never performs a cross-origin request to this API, but it still
 * sends an `Origin` header on same-origin POST/PUT/DELETE requests.
 *
 * `CLIENT_URL` accepts a comma separated list of allowed origins so that
 * preview deployments can be allowed as well.
 */
const configuredClientUrls = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = new Set([
  ...configuredClientUrls,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: same-origin navigation, curl, or server-to-server.
      if (!origin) return callback(null, true);

      // Allow list hit -> emit the CORS headers.
      if (allowedOrigins.has(origin.replace(/\/+$/, ''))) {
        return callback(null, true);
      }

      // Unknown origin: do NOT emit CORS headers, but let the request through.
      // The browser then blocks the response for cross-origin callers, while
      // same-origin requests (the supported deployment) keep working. Failing
      // the request here would turn a misconfigured CLIENT_URL into a total
      // outage of the API.
      if (!isProduction) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(isProduction ? 'combined' : 'dev'));
}

app.use(cookieParser());

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to OfferBazaar API',
    author: 'Sarvesh Mekhe',
    documentation: '/api/health',
  });
});

// API Routes
app.use('/api', routes);

// 404 & Error Handlers
app.use(notFound);
app.use(errorHandler);

export default app;
