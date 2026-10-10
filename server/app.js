import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import routes from './routes/index.js';
import { notFound } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// Security HTTP Headers
app.use(helmet());

// Cross-Origin Resource Sharing (strictly configured to deployed frontend origin; no wildcard in production)
const configuredClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const isProduction = process.env.NODE_ENV === 'production';

// In production, prohibit any wildcard '*' configuration
const allowedOrigin =
  isProduction && configuredClientUrl === '*'
    ? 'http://localhost:5173'
    : configuredClientUrl;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (isProduction) {
        if (origin === allowedOrigin) {
          return callback(null, true);
        }
        return callback(
          new Error('CORS policy: Access denied from this origin.')
        );
      }

      // Development / test: allow configured origin or localhost
      if (
        origin === allowedOrigin ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
