import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import apiRouter from './routes/api.routes';

const app = express();

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Let Next.js frontend configure its own CSP
  })
);

// Cross-Origin Resource Sharing
const allowedOrigins = [
  config.frontendUrl,
  'https://fatani-traders.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server proxies)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-ID'],
  })
);

// Body and Cookie parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  const suppliedId = req.header('x-correlation-id');
  const correlationId = suppliedId && /^[a-zA-Z0-9-]{8,64}$/.test(suppliedId) ? suppliedId : randomUUID();
  res.locals.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Global API rate limiting
app.use('/api', apiRateLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'fatani-traders-erp-api',
  });
});

// REST API routes
app.use('/api', apiRouter);

// Central error handler
app.use(errorHandler);

async function ensureAdminUser() {
  try {
    const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'hammad@gmail.com').toLowerCase().trim();
    const existing = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || '12345678';
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(adminPassword, salt);
      await prisma.adminUser.create({
        data: {
          email: adminEmail,
          passwordHash,
          fullName: process.env.INITIAL_ADMIN_NAME || 'Hammad Admin',
          role: 'ADMIN',
          isActive: true,
        },
      });
      console.log(`[BOOT] Initialized primary administrator: ${adminEmail}`);
    } else {
      console.log(`[BOOT] Administrator verified: ${adminEmail}`);
    }
  } catch (e) {
    console.warn('[BOOT] Could not check or seed default admin:', e);
  }
}

const server = app.listen(config.port, () => {
  console.log('==================================================');
  console.log(`Fatani Traders ERP Backend running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
  console.log('==================================================');

  // Idempotently ensure primary admin exists on startup
  ensureAdminUser();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down gracefully.');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

export { app, server };
