/**
 * Express cache middleware
 * - Uses CacheManager instance attached to `req.app.locals.cache`
 * - Caches GET responses by default
 * - Automatically stores JSON responses
 */

module.exports = function cacheMiddleware(options = {}) {
  const ttl = options.ttl || 60; // default 60s
  const keyPrefix = options.keyPrefix || 'route';
  const skip = options.skip || ((req) => false);

  return async function (req, res, next) {
    if (req.method !== 'GET' || skip(req)) return next();

    const cache = req.app.locals.cache;
    if (!cache) return next();

    const key = `${keyPrefix}:${req.originalUrl}`;

    try {
      const cached = await cache.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
    } catch (err) {
      // ignore cache errors
    }

    // Override res.json to capture output
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      try {
        await cache.set(key, body, ttl);
        res.setHeader('X-Cache', 'MISS');
      } catch (err) {
        // ignore
      }
      return originalJson(body);
    };

    next();
  };
};
