/**
 * Redis-backed Cache Manager
 * - Connects to Redis (or redis-mock in dev)
 * - Provides get/set/del/wrap helpers
 * - Publishes invalidation messages for coordinated cache invalidation
 * - Falls back to in-memory Map if Redis unavailable
 */

const redis = require('redis');
let redisMock = null;
try {
  // Try to use redis-mock for development if real Redis isn't available
  redisMock = require('redis-mock');
} catch (e) {
  // redis-mock not installed, that's OK
}

class CacheManager {
  constructor(options = {}) {
    this.url = options.url || process.env.REDIS_URL || 'redis://localhost:6379';
    this.namespace = options.namespace || 'chukacribs';
    this.defaultTTL = options.defaultTTL || 300; // seconds
    this.enabled = true;
    this.inMemory = new Map();
    this._init();
  }

  async _init() {
    try {
      // Try real Redis first
      this.client = redis.createClient({ url: this.url });
      this.subscriber = redis.createClient({ url: this.url });

      // Set aggressive timeout for connection attempts
      this.client.setMaxListeners(1);
      this.subscriber.setMaxListeners(1);

      this.client.on('error', (err) => {
        // Silently handle connection errors - will fallback
        this._useFallback();
      });
      this.subscriber.on('error', (err) => {
        // Silently handle subscriber errors
      });

      // Try to connect with timeout
      const connectPromise = Promise.all([
        this.client.connect(),
        this.subscriber.connect()
      ]);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 2000)
      );

      await Promise.race([connectPromise, timeoutPromise]);

      // Subscribe to invalidation channel
      const channel = `${this.namespace}:invalidation`;
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const payload = JSON.parse(message);
          if (payload && payload.key) {
            this.inMemory.delete(payload.key);
          }
        } catch (err) {
          // ignore
        }
      });

      console.log('✅ Redis cache connected');
    } catch (err) {
      // Real Redis failed, try redis-mock if in development
      if (process.env.NODE_ENV !== 'production' && redisMock) {
        try {
          this.client = redisMock.createClient();
          this.subscriber = redisMock.createClient();
          // redis-mock doesn't need async initialization
          console.log('✅ Redis cache initialized (using redis-mock for development)');
        } catch (mockErr) {
          console.warn('⚠️  Both Redis and redis-mock failed — using in-memory cache fallback');
          this.enabled = false;
        }
      } else {
        console.warn('⚠️  Redis not available — using in-memory cache fallback');
        this.enabled = false;
      }
    }
  }

  _useFallback() {
    if (this.enabled) {
      this.enabled = false;
      console.warn('⚠️  Switching to in-memory cache fallback');
    }
  }

  _key(key) {
    return `${this.namespace}:${key}`;
  }

  async get(key) {
    const k = this._key(key);
    if (this.enabled && this.client) {
      try {
        const val = await this.client.get(k);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        return this.inMemory.get(k) || null;
      }
    }

    return this.inMemory.get(k) || null;
  }

  async set(key, value, ttlSeconds = this.defaultTTL) {
    const k = this._key(key);
    const payload = JSON.stringify(value);

    if (this.enabled && this.client) {
      try {
        await this.client.set(k, payload, { EX: ttlSeconds });
        return true;
      } catch (err) {
        this.inMemory.set(k, value);
        return false;
      }
    }

    this.inMemory.set(k, value);
    // best-effort expiration using setTimeout
    setTimeout(() => this.inMemory.delete(k), ttlSeconds * 1000);
    return true;
  }

  async del(key) {
    const k = this._key(key);
    if (this.enabled && this.client) {
      try {
        await this.client.del(k);
      } catch (err) {
        // ignore
      }
    }
    this.inMemory.delete(k);

    // publish invalidation
    try {
      if (this.enabled && this.client) {
        const channel = `${this.namespace}:invalidation`;
        await this.client.publish(channel, JSON.stringify({ key }));
      }
    } catch (err) {
      // ignore
    }
  }

  /**
   * wrap: caches the result of an async function under `key`
   */
  async wrap(key, ttlSeconds, fn) {
    const existing = await this.get(key);
    if (existing !== null && existing !== undefined) return existing;

    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async invalidatePattern(pattern) {
    // only works when redis available
    if (!this.enabled || !this.client) return;

    // Redis SCAN to delete keys matching pattern
    const redisPattern = `${this.namespace}:${pattern}`;
    try {
      let cursor = 0;
      do {
        const reply = await this.client.scan(cursor, { MATCH: redisPattern, COUNT: 100 });
        cursor = parseInt(reply.cursor, 10);
        const keys = reply.keys;
        if (keys.length) {
          await this.client.del(keys);
        }
      } while (cursor !== 0);
    } catch (err) {
      console.warn('⚠️  Pattern invalidation failed:', err.message);
    }
  }

  async flushAll() {
    if (this.enabled && this.client) {
      try {
        await this.client.flushAll();
        return true;
      } catch (err) {
        return false;
      }
    }

    this.inMemory.clear();
    return true;
  }
}

module.exports = CacheManager;
