/**
 * Unified Error Handler for ChukaCribs
 * Provides consistent error response format across all routes
 */

const logger = require('./logger');

/**
 * Standard error response format
 */
const ErrorResponse = {
  success: false,
  message: '',
  error: null,
  details: null,
  timestamp: new Date().toISOString()
};

/**
 * Error codes and HTTP status mappings
 */
const ERROR_CODES = {
  VALIDATION_ERROR: { statusCode: 400, message: 'Validation error' },
  UNAUTHORIZED: { statusCode: 401, message: 'Unauthorized - Please login' },
  FORBIDDEN: { statusCode: 403, message: 'Forbidden - Access denied' },
  NOT_FOUND: { statusCode: 404, message: 'Resource not found' },
  CONFLICT: { statusCode: 409, message: 'Conflict - Resource already exists' },
  RATE_LIMIT: { statusCode: 429, message: 'Too many requests - Please try again later' },
  INTERNAL_ERROR: { statusCode: 500, message: 'Internal server error' },
  BAD_REQUEST: { statusCode: 400, message: 'Bad request' },
  SERVICE_UNAVAILABLE: { statusCode: 503, message: 'Service temporarily unavailable' }
};

/**
 * Create standardized error response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {*} error - Error details (optional)
 * @param {*} details - Additional details (optional)
 * @returns {object} - Formatted error object
 */
const createErrorResponse = (statusCode, message, error = null, details = null) => {
  return {
    success: false,
    message,
    error: process.env.NODE_ENV === 'production' ? null : error,
    details: process.env.NODE_ENV === 'production' ? null : details,
    timestamp: new Date().toISOString()
  };
};

/**
 * Handle validation errors from express-validator
 * @param {array} errors - Array of validation errors
 * @returns {object} - Formatted response
 */
const handleValidationErrors = (errors) => {
  const details = errors.map(err => ({
    field: err.param || err.path,
    message: err.msg,
    value: err.value
  }));

  return createErrorResponse(
    400,
    'Validation error',
    'One or more fields failed validation',
    details
  );
};

/**
 * Express error handling middleware
 * Should be added AFTER all route handlers
 * 
 * Usage in index.js:
 * const { errorHandler } = require('./config/errorHandler');
 * app.use(errorHandler);
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  // Log error
  logger.error(`[${req.method}] ${req.path}`, {
    statusCode,
    message,
    stack: err.stack,
    userId: req.landlordId || req.userId || 'unknown',
    ip: req.ip
  });

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = Object.entries(err.errors).map(([field, error]) => ({
      field,
      message: error.message
    }));

    return res.status(400).json(createErrorResponse(
      400,
      'Validation error',
      err.message,
      details
    ));
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json(createErrorResponse(
      409,
      `${field} already exists`,
      err.message,
      { field, value: err.keyValue[field] }
    ));
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(createErrorResponse(
      401,
      'Invalid authentication token',
      err.message
    ));
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(createErrorResponse(
      401,
      'Authentication token has expired',
      err.message
    ));
  }

  // Handle Mongoose CastError (invalid ObjectID)
  if (err.name === 'CastError') {
    return res.status(400).json(createErrorResponse(
      400,
      'Invalid resource ID format',
      err.message
    ));
  }

  // Generic error response
  return res.status(statusCode).json(createErrorResponse(
    statusCode,
    message,
    err.message,
    err.details || null
  ));
};

/**
 * Wrapper for async route handlers to catch errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not found (404) handler
 * Should be added AFTER all route handlers
 * 
 * Usage in index.js:
 * const { notFoundHandler } = require('./config/errorHandler');
 * app.use(notFoundHandler);
 */
const notFoundHandler = (req, res) => {
  res.status(404).json(createErrorResponse(
    404,
    'Endpoint not found',
    `${req.method} ${req.path} does not exist`
  ));
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  createErrorResponse,
  handleValidationErrors,
  ERROR_CODES
};
