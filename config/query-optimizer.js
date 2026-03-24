/**
 * Database Query Optimization Utilities
 * Handles indexing, query optimization, and caching
 */

const mongoose = require('mongoose');

/**
 * Query optimizer middleware
 * Automatically selects fields, populates relations, applies pagination
 */
class QueryOptimizer {
  constructor(query) {
    this.query = query;
    this.options = {};
  }

  /**
   * Select specific fields only (projection)
   * @param {string|array} fields - Fields to select
   * @returns {this}
   */
  select(fields) {
    this.query = this.query.select(fields);
    return this;
  }

  /**
   * Populate related documents
   * @param {string|object} path - Path to populate
   * @returns {this}
   */
  populate(path) {
    if (typeof path === 'string') {
      this.query = this.query.populate({
        path,
        select: '-password -tokens' // Exclude sensitive fields
      });
    } else {
      this.query = this.query.populate(path);
    }
    return this;
  }

  /**
   * Apply pagination
   * @param {number} page - Page number (1-indexed)
   * @param {number} limit - Items per page
   * @returns {this}
   */
  paginate(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    this.options.pagination = { page, limit, skip };
    return this;
  }

  /**
   * Sort results
   * @param {string} sortBy - Sort field (prefix with - for descending)
   * @returns {this}
   */
  sort(sortBy = '-createdAt') {
    this.query = this.query.sort(sortBy);
    return this;
  }

  /**
   * Lean query (faster, returns plain objects)
   * @returns {this}
   */
  lean() {
    this.query = this.query.lean();
    return this;
  }

  /**
   * Execute query
   * @returns {Promise}
   */
  async exec() {
    return this.query.exec();
  }

  /**
   * Count matching documents
   * @returns {Promise}
   */
  async count() {
    return this.query.countDocuments();
  }

  /**
   * Get results with total count
   * @returns {Promise}
   */
  async execWithCount() {
    const [data, total] = await Promise.all([
      this.query.exec(),
      this.query.clone().countDocuments()
    ]);
    return { data, total };
  }
}

/**
 * Create database indexes for common queries
 */
const createIndexes = async (model, indexes) => {
  try {
    for (const [field, options] of Object.entries(indexes)) {
      await model.collection.createIndex({ [field]: options.order || 1 }, {
        name: options.name,
        unique: options.unique || false,
        sparse: options.sparse || false,
        background: true // Create index in background
      });
    }
    console.log(`Indexes created for ${model.modelName}`);
  } catch (error) {
    console.error(`Failed to create indexes for ${model.modelName}:`, error);
  }
};

/**
 * Recommended indexes for common models
 */
const RECOMMENDED_INDEXES = {
  House: {
    'location': { order: 1, name: 'idx_location' },
    'price': { order: 1, name: 'idx_price' },
    'amenities': { order: 1, name: 'idx_amenities' },
    'landlord': { order: 1, name: 'idx_landlord' },
    'status': { order: 1, name: 'idx_status' },
    'createdAt': { order: -1, name: 'idx_createdAt' }
  },

  Booking: {
    'user': { order: 1, name: 'idx_user' },
    'house': { order: 1, name: 'idx_house' },
    'status': { order: 1, name: 'idx_status' },
    'createdAt': { order: -1, name: 'idx_createdAt' }
  },

  Landlord: {
    'email': { order: 1, unique: true, name: 'idx_email' },
    'phone': { order: 1, unique: true, sparse: true, name: 'idx_phone' },
    'createdAt': { order: -1, name: 'idx_createdAt' }
  },

  Token: {
    'user': { order: 1, name: 'idx_user' },
    'expiresAt': { order: 1, name: 'idx_expiresAt' }
  }
};

/**
 * Query cache implementation
 */
class QueryCache {
  constructor(ttl = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Generate cache key from query
   * @param {string} modelName - Model name
   * @param {object} filter - Query filter
   * @returns {string}
   */
  generateKey(modelName, filter) {
    return `${modelName}:${JSON.stringify(filter)}`;
  }

  /**
   * Get from cache
   * @param {string} key - Cache key
   * @returns {any|null}
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) {return null;}

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  /**
   * Clear cache for pattern
   * @param {string|RegExp} pattern - Pattern to match keys
   */
  clear(pattern) {
    if (typeof pattern === 'string') {
      this.cache.delete(pattern);
    } else if (pattern instanceof RegExp) {
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Query execution timer
 */
const trackQueryPerformance = (model) => {
  const originalExec = model.Query.prototype.exec;

  model.Query.prototype.exec = async function() {
    const start = Date.now();
    const result = await originalExec.call(this);
    const duration = Date.now() - start;

    if (duration > 1000) { // Log slow queries (>1s)
      console.warn(`Slow query detected on ${model.modelName}: ${duration}ms`);
      console.warn(`Filter: ${JSON.stringify(this._conditions)}`);
    }

    return result;
  };
};

module.exports = {
  QueryOptimizer,
  QueryCache,
  createIndexes,
  RECOMMENDED_INDEXES,
  trackQueryPerformance
};
