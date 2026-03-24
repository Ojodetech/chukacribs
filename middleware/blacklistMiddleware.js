/**
 * Blacklist Middleware
 * Blocks requests from blacklisted IPs/users
 */

const logger = require('../config/logger');

const blacklistMiddleware = (redisClient) => {
  return async (req, res, next) => {
    if (!redisClient) {
      return next(); // Skip if Redis not available
    }

    try {
      const identifier = req.user?.id || req.ip;
      const blacklistKey = `blacklist:${identifier}`;

      const isBlacklisted = await redisClient.get(blacklistKey);

      if (isBlacklisted) {
        logger?.warn('Blacklisted request blocked', {
          identifier,
          ip: req.ip,
          path: req.path,
          user: req.user?.id
        });

        const entry = JSON.parse(isBlacklisted);

        return res.status(403).json({
          success: false,
          statusCode: 403,
          errorCode: 'BLACKLISTED',
          message: 'Access denied. Your IP/account is blacklisted.',
          reason: entry.reason,
          addedAt: entry.addedAt
        });
      }

      next();
    } catch (err) {
      logger?.error('Blacklist middleware error', { error: err.message });
      next(); // Continue on error
    }
  };
};

module.exports = blacklistMiddleware;
