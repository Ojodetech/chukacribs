const redis = require('redis');
const logger = require('./logger');

/**
 * Session Manager
 * Handles session storage in Redis for distributed load balancing
 * Allows any instance to serve any user's session
 */
class SessionManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.sessionTTL = process.env.SESSION_TTL || 3600; // Default 1 hour
  }

  async _setWithTTL(key, value, ttl) {
    if (typeof this.redis.setex === 'function') {
      return this.redis.setex(key, ttl, value);
    }

    if (typeof this.redis.set === 'function') {
      await this.redis.set(key, value);
      if (typeof this.redis.expire === 'function') {
        return this.redis.expire(key, ttl);
      }
      return true;
    }

    throw new Error('Redis client does not support setex or set');
  }

  /**
   * Create or update session
   */
  async setSession(sessionId, sessionData) {
    try {
      const key = `session:${sessionId}`;
      const data = JSON.stringify(sessionData);
      
      await this._setWithTTL(key, data, this.sessionTTL);

      logger.debug(`Session created: ${sessionId}`);
      return true;
    } catch (err) {
      logger.error(`Session set failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (err) {
      logger.error(`Session get failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId, updates) {
    try {
      const sessionData = await this.getSession(sessionId);
      
      if (!sessionData) {
        throw new Error('Session not found');
      }

      const updated = { ...sessionData, ...updates };
      await this.setSession(sessionId, updated);
      
      logger.debug(`Session updated: ${sessionId}`);
      return updated;
    } catch (err) {
      logger.error(`Session update failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      await this.redis.del(key);
      
      logger.debug(`Session deleted: ${sessionId}`);
      return true;
    } catch (err) {
      logger.error(`Session delete failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Check if session exists
   */
  async hasSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (err) {
      logger.error(`Session exists check failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const exists = await this.redis.exists(key);
      
      if (exists !== 1) {
        return false;
      }

      // Update TTL
      await this.redis.expire(key, this.sessionTTL);
      
      logger.debug(`Session extended: ${sessionId}`);
      return true;
    } catch (err) {
      logger.error(`Session extend failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Store user authentication token
   */
  async setUserToken(userId, token, expiresIn = 86400) {
    try {
      const key = `user_token:${userId}`;
      await this._setWithTTL(key, token, expiresIn);
      
      logger.debug(`User token stored: ${userId}`);
      return true;
    } catch (err) {
      logger.error(`Token storage failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get user token
   */
  async getUserToken(userId) {
    try {
      const key = `user_token:${userId}`;
      return await this.redis.get(key);
    } catch (err) {
      logger.error(`Token retrieval failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Cache user data (for quick access)
   */
  async cacheUserData(userId, userData, ttl = 3600) {
    try {
      const key = `user_data:${userId}`;
      const data = JSON.stringify(userData);
      await this._setWithTTL(key, data, ttl);
      
      logger.debug(`User data cached: ${userId}`);
      return true;
    } catch (err) {
      logger.error(`User cache failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get cached user data
   */
  async getCachedUserData(userId) {
    try {
      const key = `user_data:${userId}`;
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (err) {
      logger.error(`User cache retrieval failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Store request for idempotency (prevent duplicate orders, payments, etc)
   */
  async storeIdempotencyKey(key, result, ttl = 86400) {
    try {
      const redisKey = `idempotency:${key}`;
      const data = JSON.stringify(result);
      await this._setWithTTL(redisKey, data, ttl);
      
      logger.debug(`Idempotency key stored: ${key}`);
      return true;
    } catch (err) {
      logger.error(`Idempotency storage failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get idempotency result (return same result for same request)
   */
  async getIdempotencyResult(key) {
    try {
      const redisKey = `idempotency:${key}`;
      const data = await this.redis.get(redisKey);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (err) {
      logger.error(`Idempotency retrieval failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Get session statistics
   */
  async getStats() {
    try {
      const info = await this.redis.info('stats');
      const memory = await this.redis.info('memory');
      
      return {
        stats: info,
        memory: memory
      };
    } catch (err) {
      logger.error(`Stats retrieval failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Clear all sessions (caution: affects all users)
   */
  async clearAllSessions() {
    try {
      // Get all session keys
      const keys = await this.redis.keys('session:*');
      
      if (keys.length === 0) {
        return 0;
      }

      // Delete all sessions
      await this.redis.del(...keys);
      
      logger.warn(`Cleared ${keys.length} sessions`);
      return keys.length;
    } catch (err) {
      logger.error(`Clear sessions failed: ${err.message}`);
      throw err;
    }
  }
}

module.exports = SessionManager;
