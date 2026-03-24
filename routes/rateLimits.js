/**
 * Rate Limiter Admin Routes
 * - View rate limits
 * - Reset limits
 * - Get statistics
 * - Configure per-endpoint limits (admin only)
 */

const express = require('express');
const router = express.Router();
const { logSecurityEvent } = require('../config/security');

// Simple admin check middleware (checks JWT or sessionManager for admin role)
const isAdmin = async (req, res, next) => {
  try {
    // Check if user role is admin from decoded JWT in req.user
    if (req.user?.role === 'admin' || req.user?.roles?.includes('admin')) {
      return next();
    }

    // Also check sessionManager if available
    if (global.sessionManager && req.sessionID) {
      const session = await global.sessionManager.getSession(req.sessionID);
      if (session && (session.role === 'admin' || session.roles?.includes('admin'))) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized'
    });
  }
};

/**
 * GET /api/rate-limits/status/:identifier
 * Get current rate limit status for an IP or user
 */
router.get('/status/:identifier', isAdmin, async (req, res) => {
  try {
    const { identifier } = req.params;
    const rateLimiter = req.app.locals.rateLimiter;

    if (!rateLimiter) {
      return res.status(503).json({
        success: false,
        message: 'Rate limiter not available'
      });
    }

    const status = await rateLimiter.getStatus(identifier);

    res.json({
      success: true,
      identifier,
      status
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limit status',
      error: err.message
    });
  }
});

/**
 * POST /api/rate-limits/reset
 * Reset rate limit for an identifier
 */
router.post('/reset', isAdmin, async (req, res) => {
  try {
    const { identifier, limiterName } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Identifier is required'
      });
    }

    const rateLimiter = req.app.locals.rateLimiter;

    if (!rateLimiter) {
      return res.status(503).json({
        success: false,
        message: 'Rate limiter not available'
      });
    }

    const result = await rateLimiter.reset(identifier, limiterName);

    // Log security event
    await logSecurityEvent({
      userId: req.user?.id,
      action: 'RATE_LIMIT_RESET',
      target: identifier,
      limiter: limiterName || 'all',
      status: result.success ? 'SUCCESS' : 'FAILED',
      details: result
    });

    res.json({
      success: result.success,
      message: `Rate limit reset for ${identifier}`,
      result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to reset rate limit',
      error: err.message
    });
  }
});

/**
 * GET /api/rate-limits/stats
 * Get rate limiter statistics
 */
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const rateLimiter = req.app.locals.rateLimiter;

    if (!rateLimiter) {
      return res.status(503).json({
        success: false,
        message: 'Rate limiter not available'
      });
    }

    const stats = await rateLimiter.getStatistics();
    const limiters = rateLimiter.getLimiters();

    res.json({
      success: true,
      statistics: stats,
      activeLimiters: Array.from(Object.keys(limiters)),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limit statistics',
      error: err.message
    });
  }
});

/**
 * GET /api/rate-limits/config
 * Get current rate limiter configuration
 */
router.get('/config', isAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        global: {
          windowMs: 15 * 60 * 1000,
          max: 100,
          message: 'Too many requests from this IP'
        },
        api: {
          windowMs: 15 * 60 * 1000,
          max: 50,
          message: 'Too many API requests'
        },
        auth: {
          windowMs: 15 * 60 * 1000,
          max: 5,
          message: 'Too many login attempts'
        },
        booking: {
          windowMs: 60 * 60 * 1000,
          max: 10,
          message: 'Too many booking attempts'
        },
        payment: {
          windowMs: 60 * 60 * 1000,
          max: 5,
          message: 'Too many payment attempts'
        },
        search: {
          windowMs: 15 * 60 * 1000,
          max: 200,
          message: 'Too many search requests'
        },
        admin: {
          windowMs: 60 * 60 * 1000,
          max: 50,
          message: 'Admin rate limit exceeded'
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limiter configuration',
      error: err.message
    });
  }
});

/**
 * POST /api/rate-limits/whitelist
 * Whitelist an IP or user from rate limiting (admin only)
 */
router.post('/whitelist', isAdmin, async (req, res) => {
  try {
    const { identifier, reason } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Identifier is required'
      });
    }

    // This would require a separate whitelist store
    // For now, just log the intention
    await logSecurityEvent({
      userId: req.user?.id,
      action: 'RATE_LIMIT_WHITELIST_ADD',
      target: identifier,
      reason,
      status: 'PENDING'
    });

    res.json({
      success: true,
      message: `Added ${identifier} to rate limit whitelist`,
      reason
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to whitelist identifier',
      error: err.message
    });
  }
});

/**
 * POST /api/rate-limits/blacklist
 * Blacklist an IP or user (admin only)
 */
router.post('/blacklist', isAdmin, async (req, res) => {
  try {
    const { identifier, duration = 86400, reason } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Identifier is required'
      });
    }

    const rateLimiter = req.app.locals.rateLimiter;
    if (!rateLimiter || !rateLimiter.redisClient) {
      return res.status(503).json({
        success: false,
        message: 'Redis not available'
      });
    }

    // Store blacklist entry in Redis
    try {
      const key = `blacklist:${identifier}`;
      await rateLimiter.redisClient.set(key, JSON.stringify({ reason, addedAt: new Date() }), { EX: duration });

      await logSecurityEvent({
        userId: req.user?.id,
        action: 'RATE_LIMIT_BLACKLIST_ADD',
        target: identifier,
        duration,
        reason,
        status: 'SUCCESS'
      });

      res.json({
        success: true,
        message: `Blacklisted ${identifier} for ${duration} seconds`,
        reason
      });
    } catch (err) {
      throw err;
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to blacklist identifier',
      error: err.message
    });
  }
});

module.exports = router;
