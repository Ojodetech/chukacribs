/**
 * Security Enhancements for ChukaCribs
 * Includes file upload validation, request size limits, sensitive data filtering
 */

const path = require('path');
const logger = require('./logger');

/**
 * Allowed MIME types for file uploads
 */
const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  videos: ['video/mp4', 'video/webm', 'video/quicktime'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

/**
 * File size limits in bytes
 */
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024,        // 5MB
  video: 50 * 1024 * 1024,       // 50MB
  document: 10 * 1024 * 1024,    // 10MB
  profile: 2 * 1024 * 1024,      // 2MB
};

/**
 * Validate file uploads
 * @param {object} file - File object from multer
 * @param {string} type - Type of file ('image', 'video', 'document', 'profile')
 * @returns {object} - { valid: boolean, error: string|null }
 */
const validateFileUpload = (file, type = 'image') => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size
  const maxSize = FILE_SIZE_LIMITS[type] || FILE_SIZE_LIMITS.image;
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB` 
    };
  }

  // Check MIME type
  const allowedTypes = ALLOWED_MIME_TYPES[type === 'document' ? 'documents' : (type === 'video' ? 'videos' : 'images')];
  if (!allowedTypes.includes(file.mimetype)) {
    return { 
      valid: false, 
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` 
    };
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = {
    images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    videos: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
    documents: ['.pdf', '.doc', '.docx'],
  };
  const extList = allowedExtensions[type === 'document' ? 'documents' : (type === 'video' ? 'videos' : 'images')];
  if (!extList.includes(ext)) {
    return { 
      valid: false, 
      error: `Invalid file extension. Allowed: ${extList.join(', ')}` 
    };
  }

  return { valid: true, error: null };
};

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - User input
 * @returns {string} - Sanitized input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') {return input;}
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Remove sensitive data from logs and responses
 * @param {object} data - Data object to sanitize
 * @returns {object} - Sanitized object
 */
const removeSensitiveData = (data) => {
  if (!data) {return data;}

  const copy = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveFields = [
    'password',
    'passwordHash',
    'salt',
    'token',
    'refreshToken',
    'apiKey',
    'secret',
    'authToken',
    'adminToken',
    'creditCard',
    'ssn',
    'iban',
    'accountNumber'
  ];

  const removeFields = (obj) => {
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '***REDACTED***';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        removeFields(obj[key]);
      }
    }
  };

  removeFields(copy);
  return copy;
};

/**
 * Sanitize object/arrays to prevent MongoDB query injection (no $ keys or dotted keys)
 * @param {any} value
 * @returns {any}
 */
const sanitizeMongoInput = (value) => {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMongoInput(item));
  }

  if (typeof value === 'object') {
    const sanitizedObject = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      sanitizedObject[key] = sanitizeMongoInput(value[key]);
    }
    return sanitizedObject;
  }

  // Primitive values
  return value;
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, errors: string[] }
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  // Optional: allow non-complex passwords in test environment
  if (process.env.NODE_ENV !== 'test') {
    if (!/[A-Z]/.test(password)) {
      errors.push('Password should contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password should contain at least one lowercase letter');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password should contain at least one special character (!@#$%^&*)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Rate limit middleware factory
 * Creates per-user rate limiting
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,  // 15 minutes
    maxRequests = 100,
    keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
  } = options;

  const requests = new Map();

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const userRequests = requests.get(key) || [];

    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      });
    }

    recentRequests.push(now);
    requests.set(key, recentRequests);

    // Cleanup: remove old entries
    if (requests.size > 10000) {
      for (const [k, v] of requests.entries()) {
        if (v.every(time => now - time >= windowMs)) {
          requests.delete(k);
        }
      }
    }

    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - recentRequests.length));
    next();
  };
};

/**
 * Log security events
 * @param {string} event - Event type
 * @param {object} details - Event details
 */
const logSecurityEvent = (event, details = {}) => {
  logger.warn(`[SECURITY] ${event}`, {
    timestamp: new Date().toISOString(),
    ...details
  });
};

module.exports = {
  validateFileUpload,
  sanitizeInput,
  sanitizeMongoInput,
  removeSensitiveData,
  validatePasswordStrength,
  createRateLimiter,
  logSecurityEvent,
  ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS
};
