// Load environment variables
require('dotenv').config();
// enable express async errors to auto-forward rejected promises
require('express-async-errors');

console.log('🚀 Starting ChukaCribs server...');
console.log('📋 Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  USE_MOCK_MPESA: process.env.USE_MOCK_MPESA,
  MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY ? '***SET***' : 'NOT SET',
  MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET ? '***SET***' : 'NOT SET',
  MPESA_BUSINESS_SHORTCODE: process.env.MPESA_BUSINESS_SHORTCODE || 'NOT SET',
  MPESA_PASSKEY: process.env.MPESA_PASSKEY ? '***SET***' : 'NOT SET',
  MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL || 'NOT SET',
  PORT: process.env.PORT || 'NOT SET'
});

const RateLimiterManager = require('./config/rateLimiter');
const blacklistMiddleware = require('./middleware/blacklistMiddleware');
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const compression = require('compression');
const connectDB = require('./config/database');
const { initSentry, sentryErrorHandler } = require('./config/sentry');
const { setupSwagger } = require('./config/swagger');
const housesRouter = require('./routes/houses');
const authRouter = require('./routes/auth');
const accessRouter = require('./routes/access');
const landlordPropertiesRouter = require('./routes/landlord-properties');
const paymentRouter = require('./routes/payment');
const bookingsRouter = require('./routes/bookings');
const smsRouter = require('./routes/sms');
// const studentRouter = require('./routes/student');
const bookingsEnhancedRouter = require('./routes/bookings-enhanced');
const notificationsRouter = require('./routes/notifications');
const subscribeRouter = require('./routes/subscribe');
// const searchRouter = require('./routes/search');
const landlordRouter = require('./routes/landlord');
const reviewsRouter = require('./routes/reviews');
const feedbackRouter = require('./routes/feedback');
const messagesRouter = require('./routes/messages');
const favoritesRouter = require('./routes/favorites');
const paymentsHistoryRouter = require('./routes/payments-history-fixed');
const ratingsRouter = require('./routes/ratings');
const analyticsRouter = require('./routes/analytics');
const adminRouter = require('./routes/admin');
const coreUserRouter = require('./routes/core-users');
const coreRoomRouter = require('./routes/core-rooms');
const coreBookingRouter = require('./routes/core-booking');
const corePaymentRouter = require('./routes/core-payment');
const { translate } = require('./config/languages');
const logger = require('./config/logger');
const { requestLoggingMiddleware, globalLogger } = require('./config/structured-logger');
const { logAggregationManager, logMetrics } = require('./config/logAggregation');
const { featureFlagManager } = require('./config/featureFlags');
const { apiVersionManager } = require('./config/versionManager');
const { tracer } = require('./config/tracer');
const tracingMiddleware = require('./middleware/tracingMiddleware');
const rateLimit = require('express-rate-limit');
const { enhancedErrorHandler, notFoundHandler } = require('./config/errors/errorHandler');
const { logSecurityEvent, sanitizeMongoInput } = require('./config/security');
// const backupService = require('./services/backup');
// Metrics (Prometheus)
const metrics = require('./config/metricsCollector');
// Item #10: Horizontal Scaling
const LoadBalancer = require('./config/loadBalancer');
const AutoScaler = require('./config/autoScaler');
const os = require('os');

// Caching
const CacheManager = require('./config/cacheManager');
const cacheExamples = require('./routes/cacheExamples');
// Load Balancing and Session Management (Task #6)
const healthRoutes = require('./routes/health');
const SessionManager = require('./config/sessionManager');
let sessionManager = null;

// Item #10: Horizontal Scaling Instances
let loadBalancer = null;
let autoScaler = null;
const instances = [];  // Registry of application instances

const app = express();

// Trust proxy is handled safely in rate limiter keyGenerator
// No global trust proxy setting needed to avoid security warnings

const PORT = parseInt(process.env.PORT, 10) || 3000;

// ============================================================================
// ENVIRONMENT VALIDATION - FAIL FAST IF REQUIRED VARS ARE MISSING
// ============================================================================
const validateEnvironment = () => {
  const required = [
    'NODE_ENV',
    'MONGODB_URI',
    'JWT_SECRET',
    'ADMIN_SECRET_KEY'
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    globalLogger.fatal('Missing required environment variables', {
      missing,
      provided: Object.keys(process.env).filter((k) => k.startsWith('MONGO') || k.startsWith('JWT'))
    });
    console.error(
      `\n❌ FATAL: Missing environment variables: ${missing.join(', ')}\n` +
        `Please set these in your .env file or CI/CD platform.\n`
    );
    process.exit(1);
  }

  // Production-specific validation
  if (process.env.NODE_ENV === 'production') {
    const prodRequired = ['HTTPS_ENABLED', 'SENTRY_DSN'];
    const prodMissing = prodRequired.filter((key) => !process.env[key]);

    if (prodMissing.length > 0) {
      globalLogger.warn('Missing production environment variables', { missing: prodMissing });
    }

    // Warn about weak secrets
    if (
      process.env.JWT_SECRET &&
      process.env.JWT_SECRET.length < 32
    ) {
      globalLogger.warn('JWT_SECRET is too short for production', {
        length: process.env.JWT_SECRET.length,
        recommended: 32
      });
    }

    if (
      process.env.ADMIN_SECRET_KEY &&
      process.env.ADMIN_SECRET_KEY.length < 16
    ) {
      globalLogger.warn('ADMIN_SECRET_KEY is too short for production', {
        length: process.env.ADMIN_SECRET_KEY.length,
        recommended: 16
      });
    }
  }

  globalLogger.info('Environment variables validated successfully');
};

validateEnvironment();

// Initialize Sentry for error tracking
initSentry(app);

// Rate Limiting - fallback limiter until enhanced manager initializes
const fallbackLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});

// Delegating variables that can be replaced at runtime once Redis is available
let rateLimiterManager = null;
let globalLimiter = fallbackLimiter;
let apiLimiter = fallbackLimiter;
let authLimiter = fallbackLimiter;
let bookingLimiter = fallbackLimiter;
let paymentLimiter = fallbackLimiter;

// Generate nonce for CSP
const crypto = require('crypto');
const getNonce = () => crypto.randomBytes(16).toString('hex');

// Security Middleware
app.use(compression()); // Enable gzip compression

// Distributed Tracing Middleware (BEFORE logging to capture trace IDs)
app.use(tracingMiddleware);

// Structured request logging (FIRST middleware - captures all requests)
app.use(requestLoggingMiddleware);

// CSP and CORS middleware (production-hardened)
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN || (isProduction ? 'https://yourdomain.com' : 'http://localhost:3000');

app.use((req, res, next) => {
  req.cspNonce = getNonce();
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${req.cspNonce}'`],
      styleSrc: ["'self'", (req, res) => `'nonce-${req.cspNonce}'`, 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

// Additional security headers
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

app.use(cors({
  origin: corsOrigin.split(',').map(o => o.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser()); // Parse cookies

// Delegate API traffic through `apiLimiter` which may be replaced at runtime
app.use('/api/', (req, res, next) => {
  console.log('🌐 API request received:', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  apiLimiter(req, res, next);
});

// Body parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware
app.use((req, res, next) => {
  try {
    req.body = sanitizeMongoInput(req.body);
    req.query = sanitizeMongoInput(req.query);
    req.params = sanitizeMongoInput(req.params);

    // HTTP parameter pollution prevention (use first value when array provided)
    if (req.query && typeof req.query === 'object') {
      for (const key of Object.keys(req.query)) {
        if (Array.isArray(req.query[key])) {
          req.query[key] = req.query[key][0];
        }
      }
    }

    next();
  } catch (err) {
    logSecurityEvent('InputSanitizationError', { error: err.message });
    res.status(400).json({ success: false, message: 'Invalid input' });
  }
});

// Prometheus HTTP metrics middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  const originalEnd = res.end;

  // Capture response finish to record duration and sizes
  res.end = function (chunk, encoding) {
    try {
      const [s, ns] = process.hrtime(start);
      const duration = s + ns / 1e9; // seconds
      const route = req.route && req.route.path ? req.route.path : req.path || req.originalUrl;
      const statusCode = res.statusCode || 200;
      const reqSize = req.socket && req.socket.bytesRead ? req.socket.bytesRead : undefined;
      const resSizeHeader = res.getHeader && res.getHeader('Content-Length');
      const resSize = resSizeHeader ? parseInt(resSizeHeader, 10) : undefined;

      // Record basic http metrics
      try {
        metrics.recordHttpRequest(req.method, route, String(statusCode), duration, reqSize, resSize);
      } catch (err) {
        // Don't let metrics errors affect response
        console.error('Metrics recording error', err);
      }
    } catch (err) {
      // swallow
    }

    // call original end
    return originalEnd.call(this, chunk, encoding);
  };

  next();
});

// (Nonce injection middleware removed - static assets served directly)

// Serve static assets but disable automatic index file serving so
// route handlers can inject CSP nonces via `sendHtmlWithNonce`.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/landlord-portal', express.static(path.join(__dirname, 'landlord-portal'), { index: false }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Startup sequence: Initialize database BEFORE starting server
let dbConnected = false;

// Initialize SessionManager with Redis client
const initializeSessionManager = async () => {
  try {
    const redis = require('redis');
    const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ?
      `redis://${process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : ''}${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` :
      'redis://localhost:6379');
    const redisClient = redis.createClient({
      url: redisUrl,
      database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Redis retry time exhausted');
          return Math.min(retries * 100, 3000);
        }
      }
    });

    await redisClient.connect();
    sessionManager = new SessionManager(redisClient);
    logger?.info('✅ SessionManager initialized with Redis');
    globalLogger?.info('SessionManager ready');
    return true;
  } catch (error) {
    logger?.warn('Failed to initialize SessionManager', error);
    globalLogger?.warn('SessionManager initialization failed', { error: error.message });
    // Application continues without SessionManager (sessions won't be distributed)
    return false;
  }
};

// Expose SessionManager globally for route handlers
global.sessionManager = null;

// Startup sequence: Initialize database BEFORE starting server
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing ChukaCribs application...');
    console.log('📡 Step 1: Initializing SessionManager for distributed sessions...');
    
    // Initialize SessionManager first
    const sessionReady = await initializeSessionManager();
    global.sessionManager = sessionManager;
    
    if (sessionReady) {
      console.log('✅ Step 1a Complete: SessionManager ready for distributed sessions');
    } else {
      console.log('⚠️ Step 1a: SessionManager not available - sessions won\'t be distributed');
    }
    
    console.log('📡 Step 1b: Establishing MongoDB connection...');
    
    // Wait for database connection BEFORE starting server
    dbConnected = await connectDB();
    
    if (dbConnected) {
      logger.info('✅ Using MongoDB for data persistence');
      console.log('✅ Step 1b Complete: MongoDB connected successfully');
    } else {
      logger.warn('⚠️ MongoDB unavailable - server running in degraded mode');
      console.log('⚠️ Step 1b: MongoDB not available - proceeding without database');
    }

    // ========================================================================
    // ITEM #10: Initialize Load Balancer and Auto Scaler
    // ========================================================================
    try {
      console.log('📡 Step 1c: Initializing Load Balancer and Auto-Scaler...');
      
      loadBalancer = new LoadBalancer({
        strategy: 'least-connection',
        sessionAffinity: true,
        sessionTimeout: 3600000,
        healthCheckInterval: 5000
      });
      
      autoScaler = new AutoScaler({
        minInstances: parseInt(process.env.MIN_INSTANCES || '2'),
        maxInstances: parseInt(process.env.MAX_INSTANCES || '10'),
        scaleCpuUpThreshold: parseInt(process.env.SCALE_CPU_UP || '70'),
        scaleMemUpThreshold: parseInt(process.env.SCALE_MEM_UP || '75'),
        scaleReqUpThreshold: parseInt(process.env.SCALE_REQ_UP || '1000'),
        scaleRespUpThreshold: parseInt(process.env.SCALE_RESP_UP || '1000'),
        cooldownPeriod: parseInt(process.env.COOLDOWN_PERIOD || '60000')
      });
      
      // Start auto-scaling evaluation loop (every 10 seconds)
      setInterval(() => {
        if (loadBalancer && loadBalancer.instances.length > 0) {
          const instancesWithMetrics = loadBalancer.instances.map(inst => ({
            ...inst,
            cpuUsage: (os.loadavg()[0] / os.cpus().length) * 100,
            memoryUsage: (os.totalmem() - os.freemem()) / os.totalmem() * 100,
            totalRequests: metrics.requestCount || 0,
            responseTime: metrics.avgResponseTime || 0
          }));
          
          const scalingDecision = autoScaler.evaluateScaling(instancesWithMetrics);
          if (scalingDecision) {
            globalLogger.info(`Auto-scaling: ${scalingDecision.action}`, { instances: scalingDecision.newInstanceCount });
          }
        }
      }, 10000);
      
      app.locals.loadBalancer = loadBalancer;
      app.locals.autoScaler = autoScaler;
      
      console.log('✅ Step 1c Complete: Load Balancer and Auto-Scaler initialized');
      globalLogger.info('Load Balancer initialized', { minInstances: autoScaler.minInstances, maxInstances: autoScaler.maxInstances });
    } catch (error) {
      logger.warn('⚠️ Load Balancer init failed', error);
      globalLogger.warn('Load Balancer failed', { error: error.message });
    }
    
    // ==============================================================
    // ITEM #2 (in initializeApp): db and services are initialized.
    // Server is started from top-level bootstrap for Render.
    // ==============================================================
    console.log('✅ Step 1d: Application initialization continuing after DB and services');

    // ========================================================================
    // ITEM #7: Setup periodic log cleanup (daily at 2 AM)
    // ========================================================================
    const setupLogCleanup = () => {
      const scheduleNextCleanup = () => {
        const now = new Date();
        const nextCleanup = new Date();
        nextCleanup.setHours(2, 0, 0, 0); // 2 AM
        
        // If it's already past 2 AM today, schedule for tomorrow
        if (nextCleanup <= now) {
          nextCleanup.setDate(nextCleanup.getDate() + 1);
        }
        
        const timeout = nextCleanup.getTime() - now.getTime();
        
        return setTimeout(() => {
          try {
            const deletedCount = logAggregationManager.cleanupOldLogs(30); // Keep 30 days
            logAggregationManager.log('info', 'Automated log cleanup completed', {
              deletedCount,
              retentionDays: 30,
              nextCleanupTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
          } catch (err) {
            console.error('[LogCleanup] Cleanup failed:', err.message);
          }
          
          // Schedule next cleanup
          scheduleNextCleanup();
        }, timeout);
      };
      
      const timeoutId = scheduleNextCleanup();
      console.log('📅 Log cleanup scheduled for 2 AM daily');
      
      return timeoutId;
    };
    
    if (typeof logAggregationManager !== 'undefined' && logAggregationManager) {
      setupLogCleanup();
    }
    
  } catch (error) {
    logger.error('Fatal initialization error:', error);
    console.error('❌ Fatal error during application initialization:', error);
    process.exit(1);
  }
};

// Export app for testing BEFORE server starts
module.exports = app;

// Start HTTP server with graceful shutdown (static port only)
const startServer = () => {
  const server = app.listen(PORT, "0.0.0.0",() => {
    logger.info(`🏠 ChukaCribs server running on http://localhost:${PORT}`);
    globalLogger.info('✅ Server started successfully', {
      port: PORT,
      host: '0.0.0.0',
      nodeEnv: process.env.NODE_ENV,
      uptime: process.uptime()
    });
    console.log(`\n🏠 ChukaCribs server is running on http://localhost:${PORT}`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/api/houses`);
    console.log(`🏪 Landlord Portal: http://localhost:${PORT}/landlord-login`);
    console.log(`💚 Visit the website and explore available houses!\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const errorMsg = `Port ${PORT} is already in use; Render expects this port.`;
      logger.error(errorMsg);
      globalLogger.error(errorMsg);
      console.error(`❌ ${errorMsg}`);
      process.exit(1);
    }

    logger.error('Server error:', err);
    globalLogger.error('Server error', { error: err.message, code: err.code });
    console.error('❌ Server error:', err.message);

    server.close(async () => {
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
        }
      } catch (closeErr) {
        // ignore
      }
      setTimeout(() => process.exit(1), 1000);
    });
  });

  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received, gracefully shutting down...`);
    globalLogger.info(`Shutdown signal received: ${signal}`);

    server.close(async () => {
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
          globalLogger.info('Database connection closed');
          console.log('✅ Database connection closed');
        }
      } catch (err) {
        globalLogger.error('Error closing database', { error: err.message });
        console.error('Error closing database:', err.message);
      }

      try {
        globalLogger.close();
      } catch (err) {
        // ignore
      }

      console.log('✅ Server shutdown complete');
      globalLogger.info('Server shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('⚠️  Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

// Start server immediately for platforms like Render that expect immediate port binding
if (process.env.NODE_ENV !== 'test') {
  // Start server immediately
  console.log('🚀 Starting ChukaCribs server...');
  startServer();

  // Do async initialization in background
  initializeApp().catch(error => {
    console.error('❌ Error during background application initialization:', error);
    logger.error('Background initialization failed', { error: error.message });
    // Do not exit the process here to keep the HTTP server alive for Render
  });
}

// Initialize CacheManager and attach to app.locals so routes/middleware can use it
const cache = new CacheManager({
  url: process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : 'redis://localhost:6379'),
  defaultTTL: parseInt(process.env.CACHE_TTL) || 300,
  namespace: process.env.CACHE_NAMESPACE || 'chukacribs'
});
app.locals.cache = cache;

// Instrument cache get for Prometheus metrics (best-effort)
if (metrics && cache) {
  try {
    const origGet = cache.get.bind(cache);
    cache.get = async (key) => {
      const res = await origGet(key);
      try {
        if (res !== null && res !== undefined) metrics.recordCacheHit(cache.enabled ? 'redis' : 'memory');
        else metrics.recordCacheMiss(cache.enabled ? 'redis' : 'memory');
      } catch (e) {
        // ignore metric errors
      }
      return res;
    };
  } catch (err) {
    // ignore
  }
}

// Mount cache example routes
app.use('/api/cache', cacheExamples);
// Initialize enhanced RateLimiterManager using Redis client from cache (best-effort)
try {
  const redisClient = cache && cache.enabled && cache.client ? cache.client : null;
  rateLimiterManager = new RateLimiterManager(redisClient);
  app.locals.rateLimiter = rateLimiterManager;

  // Create reusable limiter middlewares
  apiLimiter = rateLimiterManager.apiLimiter();
  globalLimiter = rateLimiterManager.globalLimiter();
  authLimiter = rateLimiterManager.authLimiter();
  bookingLimiter = rateLimiterManager.bookingLimiter();
  paymentLimiter = rateLimiterManager.paymentLimiter();
  const searchLimiter = rateLimiterManager.searchLimiter();
  const adminLimiter = rateLimiterManager.adminLimiter();

  // Mount blacklist middleware (uses Redis when available)
  app.use(blacklistMiddleware(rateLimiterManager?.redisClient));

  // Mount rate-limits admin routes
  app.use('/api/rate-limits', require('./routes/rateLimits'));

  console.log('✅ RateLimiterManager initialized');
} catch (err) {
  console.warn('⚠️ RateLimiterManager initialization failed — using fallback limiter', err.message);
}
// API Routes
app.use('/health', healthRoutes);  // Load Balancing - Health check routes (no auth required)
app.use('/api/houses', housesRouter);
app.use('/api/auth', authLimiter, authRouter);
// app.use('/api/auth/student', studentRouter);
app.use('/api/access', accessRouter);
app.use('/api/sms', smsRouter);
app.use('/api/subscribe', subscribeRouter); // coming soon signups
app.use('/api/landlord-properties', landlordPropertiesRouter);
app.use('/api/payment', paymentLimiter, paymentRouter);
app.use('/api/bookings', bookingLimiter, bookingsEnhancedRouter);
app.use('/api/notifications', notificationsRouter);
// app.use('/api/search', searchRouter);
app.use('/api/landlord', landlordRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/payments-history', paymentsHistoryRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminRouter);

// ============================================================================
// 🧠 CORE BUSINESS SYSTEM - Rental operation core
// ============================================================================
app.use('/api/core', coreUserRouter);
app.use('/api/core', coreRoomRouter);
app.use('/api/core', coreBookingRouter);
app.use('/api/core', corePaymentRouter);

// ============================================================================
// ITEM #7: LOG AGGREGATION - Admin endpoints for log management
// ============================================================================
const logsRouter = require('./routes/logs');
app.use('/api/logs', logsRouter);

// ============================================================================
// ITEM #10: HORIZONTAL SCALING - Load balancer and auto-scaler status
// ============================================================================
app.get('/api/scaling/status', (req, res) => {
  if (!loadBalancer) {
    return res.status(503).json({ error: 'Load balancer not initialized' });
  }
  res.json({
    loadBalancer: loadBalancer.getStats(),
    autoScaler: autoScaler ? autoScaler.getStats() : null,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/scaling/instance', (req, res) => {
  const { action, host, port } = req.body;
  if (!loadBalancer) return res.status(503).json({ error: 'Load balancer unavailable' });
  
  if (action === 'add') {
    const id = loadBalancer.addInstance({ host, port });
    res.json({ message: 'Instance added', id });
  } else if (action === 'remove') {
    loadBalancer.removeInstance(req.body.instanceId);
    res.json({ message: 'Instance removed' });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// ============================================================================
// ITEM #12: DISTRIBUTED TRACING - Request tracing across services
// ============================================================================
const tracesRouter = require('./routes/traces');
app.use('/api/traces', tracesRouter);

// ============================================================================
// ITEM #14: API VERSIONING - Version management endpoints
// ITEM #15: FEATURE FLAGS - Feature flag management and A/B testing
// ============================================================================
const featureFlagsRouter = require('./routes/featureFlags');
app.use('/api/flags', featureFlagsRouter);

// Make feature flags and version manager available to routes
app.locals.featureFlagManager = featureFlagManager;
app.locals.apiVersionManager = apiVersionManager;
app.locals.tracer = tracer;

// Metrics endpoint (protected by basic token in env: METRICS_TOKEN)
app.get('/metrics', async (req, res) => {
  try {
    const token = process.env.METRICS_TOKEN || null;
    if (token) {
      const auth = req.headers['authorization'] || req.query.token || '';
      if (!auth || (auth !== `Bearer ${token}` && auth !== token)) {
        return res.status(401).send('Unauthorized');
      }
    }

    const metricsData = await metrics.getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metricsData);
  } catch (err) {
    console.error('Failed to get metrics', err);
    res.status(500).send('Failed to get metrics');
  }
});

// Swagger API Documentation
setupSwagger(app);

// Help center page
app.get('/help', (req, res) => {
  sendHtmlWithNonce(res, req, 'public/help-center.html');
});

// Privacy Policy page
app.get('/privacy-policy', (req, res) => {
  sendHtmlWithNonce(res, req, 'public/privacy-policy.html');
});

// Terms of Service page (ready for future implementation)
app.get('/terms-of-service', (req, res) => {
  // TODO: Create terms-of-service.html with similar design system
  sendHtmlWithNonce(res, req, 'public/terms-of-service.html');
});

// Test endpoint that doesn't use database
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is responding' });
});

// Serve index.html (inject CSP nonce into inline scripts/styles)
app.get('/', (req, res) => {
  sendHtmlWithNonce(res, req, 'public/index.html');
});

// Helper to read HTML file, inject per-request nonce into <script>/<style> tags, and send
const sendHtmlWithNonce = (res, req, relativePath) => {
  try {
    const filePath = path.join(__dirname, relativePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }

    let html = fs.readFileSync(filePath, 'utf8');
    const nonce = req.cspNonce || getNonce();

    // Inject nonce into ALL <script> and <style> tags that don't already have one
    // This handles both inline and external scripts
    html = html.replace(/<script\b(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);
    html = html.replace(/<style\b(?![^>]*\bnonce=)/g, `<style nonce="${nonce}"`);

    // If the page contains no <script> tags at all, insert a reference
    // to an external noop script so browsers receive a script with the nonce
    // (we DO NOT add inline scripts). The external file is empty.
    if (!/\<script\b/i.test(html)) {
      const headClose = html.lastIndexOf('</head>');
      const externalTag = `<script src="/js/_nonce.js" nonce="${nonce}"></script>`;
      if (headClose !== -1) {
        html = html.slice(0, headClose) + externalTag + html.slice(headClose);
      } else {
        const bodyOpen = html.indexOf('<body');
        if (bodyOpen !== -1) {
          const bodyStart = html.indexOf('>', bodyOpen);
          if (bodyStart !== -1) {
            html = html.slice(0, bodyStart + 1) + externalTag + html.slice(bodyStart + 1);
          } else {
            html = externalTag + html;
          }
        } else {
          html = externalTag + html;
        }
      }
    }

    // Send the modified HTML
    res.send(html);
  } catch (err) {
    logger.error('sendHtmlWithNonce error', err);
    res.status(500).send('Server error');
  }
};

// Serve listings page with nonce
app.get('/listings', (req, res) => {
  sendHtmlWithNonce(res, req, 'public/listings.html');
});

// Serve landlord portal main page and related portal pages with nonce injection
app.get(['/landlord-portal', '/landlord-portal/landlord-login.html', '/landlord-login'], (req, res) => {
  sendHtmlWithNonce(res, req, 'landlord-portal/landlord-login.html');
});

app.get(['/landlord-portal/landlord-register.html', '/landlord-register'], (req, res) => {
  sendHtmlWithNonce(res, req, 'landlord-portal/landlord-register.html');
});

app.get('/verify-email-pending', (req, res) => {
  sendHtmlWithNonce(res, req, 'landlord-portal/verify-email-pending.html');
});

app.get('/verify-email', (req, res) => {
  sendHtmlWithNonce(res, req, 'landlord-portal/verify-email.html');
});

app.get('/verify-email-success', (req, res) => {
  sendHtmlWithNonce(res, req, 'landlord-portal/verify-email-success.html');
});

// Serve landlord dashboard (use nonce injection)
app.get('/landlord-portal/landlord-dashboard.html', (req, res) => {
  sendHtmlWithNonce(res, req, 'landlord-portal/landlord-dashboard.html');
});

// Alias for landlord dashboard
app.get('/landlord-dashboard', (req, res) => {
  sendHtmlWithNonce(res, req, 'landlord-portal/landlord-dashboard.html');
});

// Serve admin dashboard (use nonce injection)
app.get(['/admin-dashboard', '/admin'], (req, res) => {
  sendHtmlWithNonce(res, req, 'public/admin-dashboard.html');
});

// Health check endpoints for Docker/Kubernetes orchestration
/**
 * Health Check Endpoints (Task #6 - Load Balancing)
 * 
 * These endpoints are essential for orchestration systems:
 * - /health/live: Liveness probe - is the process alive?
 * - /health/ready: Readiness probe - is the app ready to handle requests?
 * - /health/detailed: Full component status report
 * - /health/metrics: Load metrics for intelligent load balancing
 * - /health: Default health check (used by Docker HEALTHCHECK)
 * 
 * Load Balancer Behavior:
 * - Nginx: Checks every 10 seconds, marks down after 3 failures
 * - HAProxy: Checks every 3 seconds, marks down after 3 failures
 * - Kubernetes: Monitors both liveness and readiness independently
 * 
 * These routes are NOT rate-limited as they're critical for operations.
 */

// SEO Meta Tags Middleware
app.use((req, res, next) => {
  res.set({
    'X-UA-Compatible': 'IE=edge',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

// Sentry error handler (must be before other error handlers)
app.use(sentryErrorHandler());

// Enhanced error handling middleware (comprehensive)
app.use(enhancedErrorHandler);

// 404 handler (MUST be last)
app.use(notFoundHandler);

// Server start is triggered from initializeApp() after DB initialization
// avoid calling startServer() twice which can cause EADDRINUSE errors

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  globalLogger.fatal('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    code: error.code
  });
  console.error('Uncaught Exception:', error);
  // Do not exit immediately; allow graceful shutdown
  setTimeout(() => process.exit(1), 5000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  globalLogger.error('Unhandled Promise Rejection', {
    reason: String(reason),
    promise: String(promise)
  });
  console.error('Unhandled Rejection:', reason);
});