/**
 * Enhanced Rate Limiting Configuration
 * - Global rate limits (IP-based)
 * - Per-endpoint rate limits (API routes)
 * - Per-user rate limits (authenticated requests)
 * - Sliding window algorithm using Redis
 * - Admin API for rate limit management
 * - Metrics integration with Prometheus
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const logger = require('./logger');

class RateLimiterManager {
  constructor(redisClient) {
    this.redisClient = redisClient;
    this.limiters = new Map();
    this.metrics = null;
  }

  /**
   * Create a rate limiter with Redis store
   * Falls back to memory store if Redis unavailable
   */
  createLimiter(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100,
      message = 'Too many requests, please try again later.',
      statusCode = 429,
      keyGenerator = undefined,
      skip = () => false,
      name = 'generic'
    } = options;

    let store = null;

    // Try to use Redis store if available and compatible
    if (this.redisClient && typeof RedisStore === 'function') {
      try {
        // rate-limit-redis supports passing a client (ioredis or node-redis compatible)
        store = new RedisStore({
          client: this.redisClient,
          prefix: `rate-limit:${name}:`
        });
      } catch (err) {
        logger?.warn('Failed to create Redis rate limit store - falling back to memory', { error: err.message });
        store = null;
      }
    }

    // Handler invoked when limit exceeded
    const handler = (req, res, next, options) => {
      try {
        logger?.warn('Rate limit reached', {
          ip: req.ip,
          user: req.user?.id,
          path: req.path,
          limiter: name,
          limit: max,
          window: `${windowMs / 1000}s`
        });

        if (this.metrics && typeof this.metrics.recordRateLimitExceeded === 'function') {
          try { this.metrics.recordRateLimitExceeded(name, req.method, req.path); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        // ignore logging errors
      }

      // Send standardized response
      try {
        res.status(options && options.statusCode ? options.statusCode : statusCode).json({
          success: false,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          message: message
        });
      } catch (e) {
        try { res.status(statusCode).send(message); } catch (e2) { /* ignore */ }
      }
    };

    const limiter = rateLimit({
      store,
      windowMs,
      max,
      message,
      statusCode,
      keyGenerator,
      skip,
      standardHeaders: false, // Disable `RateLimit-*` headers
      legacyHeaders: false, // Disable `X-RateLimit-*` headers
      handler
    });

    this.limiters.set(name, limiter);
    return limiter;
  }

  /**
   * Global rate limiter (all traffic)
   * 100 requests per 15 minutes per IP
   */
  globalLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again after 15 minutes.',
      name: 'global'
    });
  }

  /**
   * API rate limiter (stricter for API calls)
   * 50 requests per 15 minutes per IP
   */
  apiLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: 'Too many API requests, please try again after 15 minutes.',
      name: 'api',
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/metrics';
      }
    });
  }

  /**
   * Authentication rate limiter (strict)
   * 5 attempts per 15 minutes per IP
   * Protects against brute force attacks
   */
  authLimiter() {
    const isTestEnv = process.env.NODE_ENV === 'test';

    return this.createLimiter({
      windowMs: isTestEnv ? 60 * 1000 : 15 * 60 * 1000, // 1 minute in test, 15 minutes in production
      max: isTestEnv ? 100 : 5,
      message: 'Too many login attempts, please try again later.',
      name: 'auth',
      skip: (req) => !!req.user?.id // Skip for already authenticated users
    });
  }

  /**
   * Booking rate limiter
   * 10 bookings per hour per user
   */
  bookingLimiter() {
    return this.createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10,
      message: 'Too many booking attempts, please try again after 1 hour.',
      name: 'booking',
      skip: (req) => !req.user?.id
    });
  }

  /**
   * Payment rate limiter
   * 5 payment attempts per hour per user
   */
  paymentLimiter() {
    return this.createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5,
      message: 'Too many payment attempts, please try again after 1 hour.',
      name: 'payment',
      skip: (req) => !req.user?.id
    });
  }

  /**
   * Search/Query rate limiter (higher limit for read operations)
   * 200 requests per 15 minutes per IP
   */
  searchLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: 'Too many search requests, please try again after 15 minutes.',
      name: 'search'
    });
  }

  /**
   * Admin operations rate limiter
   * 50 requests per hour per admin user
   */
  adminLimiter() {
    return this.createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50,
      message: 'Admin rate limit exceeded.',
      name: 'admin',
      skip: (req) => req.user?.role !== 'admin'
    });
  }

  /**
   * Create custom rate limiter
   */
  createCustomLimiter(name, config) {
    return this.createLimiter({ name, ...config });
  }

  /**
   * Get current rate limit status for an IP or user
   */
  async getStatus(identifier) {
    if (!this.redisClient) {
      return { error: 'Redis not available' };
    }

    try {
      const keys = await this.redisClient.keys(`rate-limit:*:${identifier}`);
      const result = {};

      for (const key of keys) {
        const count = await this.redisClient.get(key);
        const ttl = await this.redisClient.ttl(key);
        const [, limiterName] = key.match(/rate-limit:([^:]+):/) || [null, 'unknown'];

        result[limiterName] = {
          count: parseInt(count) || 0,
          ttl: ttl > 0 ? ttl : 0,
          remaining: Math.max(0, 100 - (parseInt(count) || 0)) // Adjust based on actual limits
        };
      }

      return result;
    } catch (err) {
      logger?.error('Failed to get rate limit status', { error: err.message });
      return { error: err.message };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier, limiterName = null) {
    if (!this.redisClient) {
      return { error: 'Redis not available' };
    }

    try {
      const pattern = limiterName
        ? `rate-limit:${limiterName}:${identifier}`
        : `rate-limit:*:${identifier}`;

      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }

      logger?.info('Rate limit reset', { identifier, limiterName, keysReset: keys.length });
      return { success: true, keysReset: keys.length };
    } catch (err) {
      logger?.error('Failed to reset rate limit', { error: err.message });
      return { error: err.message };
    }
  }

  /**
   * Get all active limiters
   */
  getLimiters() {
    return Object.fromEntries(this.limiters);
  }

  /**
   * Set metrics collector for recording rate limit events
   */
  setMetrics(metricsCollector) {
    this.metrics = metricsCollector;
  }

  /**
   * Get rate limiter statistics
   */
  async getStatistics() {
    if (!this.redisClient) {
      return { error: 'Redis not available', limiters: Array.from(this.limiters.keys()) };
    }

    try {
      const stats = {};

      for (const [name] of this.limiters) {
        const keys = await this.redisClient.keys(`rate-limit:${name}:*`);
        stats[name] = {
          activeIdentifiers: keys.length,
          totalRequests: 0
        };

        // Sum up all requests for this limiter
        for (const key of keys) {
          const count = await this.redisClient.get(key);
          stats[name].totalRequests += parseInt(count) || 0;
        }
      }

      return stats;
    } catch (err) {
      logger?.error('Failed to get rate limit statistics', { error: err.message });
      return { error: err.message };
    }
  }
}

module.exports = RateLimiterManager;
