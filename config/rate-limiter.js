/**
 * Per-user Rate Limiting Middleware
 * Implements rate limiting based on user ID/IP with different tiers
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Initialize Redis client (optional, falls back to memory store)
let redisClient;
let store;

try {
  if (process.env.REDIS_URL) {
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    redisClient.connect();
    
    store = new RedisStore({
      client: redisClient,
      prefix: 'rate-limit:',
      expiry: 60 * 15 // 15 minutes
    });
  }
} catch (error) {
  console.warn('Redis not available, using memory store for rate limiting');
}

/**
 * Create rate limiter for API endpoints
 */
const createApiLimiter = (windowMs, maxRequests, message) => {
  return rateLimit({
    store,
    windowMs,
    max: maxRequests,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?.id || req.ip;
    },
    skip: (req, res) => {
      // Skip rate limiting for admins
      return req.user?.role === 'admin';
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message,
        retryAfter: req.rateLimit.resetTime
      });
    }
  });
};

/**
 * Rate limiters by feature
 */
const limiters = {
  // Strict limits for auth endpoints
  auth: createApiLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 requests per IP
    'Too many login attempts, please try again later'
  ),

  // Moderate limits for payments
  payments: createApiLimiter(
    60 * 60 * 1000, // 1 hour
    50, // 50 requests per user per hour
    'Too many payment requests, please wait'
  ),

  // Generous limits for property browsing
  properties: createApiLimiter(
    60 * 1000, // 1 minute
    100, // 100 requests per user per minute
    'Too many requests, please slow down'
  ),

  // Strict limits for upload
  upload: createApiLimiter(
    60 * 60 * 1000, // 1 hour
    10, // 10 uploads per user per hour
    'Upload limit exceeded, try again later'
  ),

  // SMS limits
  sms: createApiLimiter(
    60 * 60 * 1000, // 1 hour
    5, // 5 SMS per user per hour
    'SMS limit reached, try again later'
  ),

  // Booking limits
  booking: createApiLimiter(
    60 * 60 * 1000, // 1 hour
    20, // 20 bookings per user per hour
    'Too many bookings, please wait'
  )
};

/**
 * Custom rate limiter with tiered limits based on user type
 */
const tieredLimiter = (req, res, next) => {
  const userId = req.user?.id || req.ip;
  const userTier = req.user?.tier || 'free'; // free, premium, admin

  const limits = {
    free: { windowMs: 60 * 1000, max: 30 },
    premium: { windowMs: 60 * 1000, max: 100 },
    admin: { windowMs: 60 * 1000, max: 1000 }
  };

  const limit = limits[userTier] || limits.free;

  const limiter = rateLimit({
    store,
    windowMs: limit.windowMs,
    max: limit.max,
    keyGenerator: () => userId,
    skip: (req, res) => userTier === 'admin'
  });

  limiter(req, res, next);
};

/**
 * Progressive rate limiting (increases limits based on reputation)
 */
const progressiveLimiter = (req, res, next) => {
  const userId = req.user?.id || req.ip;
  const reputation = req.user?.reputation || 0; // 0-100

  // Calculate dynamic limits based on reputation
  const maxRequests = Math.floor(30 + (reputation * 0.7)); // Up to 100 requests

  const limiter = rateLimit({
    store,
    windowMs: 60 * 1000,
    max: maxRequests,
    keyGenerator: () => userId
  });

  limiter(req, res, next);
};

/**
 * Middleware to apply to routes
 */
module.exports = {
  limiters,
  tieredLimiter,
  progressiveLimiter,
  createApiLimiter
};
