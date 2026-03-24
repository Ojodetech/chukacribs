/**
 * Example routes demonstrating caching usage
 */

const express = require('express');
const router = express.Router();
const cacheMiddleware = require('../middleware/cacheMiddleware');
const House = require('../models/House');

// Example: Cache houses list for 60 seconds
router.get('/houses', cacheMiddleware({ ttl: 60, keyPrefix: 'houses' }), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch from DB
    const houses = await House.find()
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    res.json({
      success: true,
      data: houses,
      pagination: { page, limit, count: houses.length }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch houses',
      error: err.message
    });
  }
});

// Example: Direct cache usage (wrap pattern)
router.get('/featured', async (req, res) => {
  try {
    const cache = req.app.locals.cache;
    
    const featured = await cache.wrap('featured_houses', 3600, async () => {
      return await House.find({ featured: true })
        .limit(5)
        .lean()
        .exec();
    });

    res.json({ success: true, data: featured });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured houses',
      error: err.message
    });
  }
});

// Example: Invalidate cache on demand
router.post('/invalidate/:key', async (req, res) => {
  try {
    const cache = req.app.locals.cache;
    const key = req.params.key;
    
    if (cache) {
      await cache.del(key);
    }

    res.json({
      success: true,
      message: `Cache key "${key}" invalidated`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate cache',
      error: err.message
    });
  }
});

// Example: Cache stats
router.get('/stats', async (req, res) => {
  try {
    const cache = req.app.locals.cache;
    
    res.json({
      success: true,
      cacheEnabled: cache?.enabled || false,
      inMemoryCacheSize: cache?.inMemory?.size || 0,
      message: cache?.enabled ? 'Using redis-mock/Redis' : 'Using in-memory cache fallback'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to get cache stats',
      error: err.message
    });
  }
});

module.exports = router;
