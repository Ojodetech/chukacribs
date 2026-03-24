/**
 * Enhanced Error Handler Middleware
 * Comprehensive error handling with logging, recovery, and monitoring
 */

const logger = require('../logger');
const Sentry = require('@sentry/node');
const errorMonitor = require('./errorMonitor');
const {
  AppError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  RateLimitError,
  ServiceUnavailableError
} = require('./index');

/**
 * Format error response
 */
const formatErrorResponse = (error, includeStackTrace = false) => {
  const response = {
    success: false,
    statusCode: error.statusCode || 500,
    errorCode: error.errorCode || 'INTERNAL_ERROR',
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  };

  // Include details in development/staging
  if (process.env.NODE_ENV !== 'production') {
    response.details = error.details;
    if (includeStackTrace) {
      response.stack = error.stack;
    }
  }

  return response;
};

/**
 * Log error with context
 */
const logError = (error, req, context = {}) => {
  const errorData = {
    errorCode: error.errorCode,
    statusCode: error.statusCode,
    message: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.userId || req.landlordId || 'anonymous',
    ...context
  };

  // Choose log level based on status code
  if (error.statusCode >= 500) {
    logger.error('Server Error', errorData);
    // Send to error tracking service
    if (error.isOperational === false) {
      Sentry.captureException(error);
    }
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error', errorData);
  } else {
    logger.info('Request Error', errorData);
  }

  return errorData;
};

/**
 * Main error handling middleware
 */
const enhancedErrorHandler = (err, req, res, next) => {
  // Handle express-async-errors
  if (!err instanceof AppError) {
    // Convert various error types to AppError
    let appError = err;

    // Mongoose validation error
    if (err.name === 'ValidationError' && err.errors) {
      appError = ValidationError.fromMongooseError(err);
    }
    // Mongoose duplicate key error
    else if (err.code === 11000) {
      appError = DatabaseError.fromDuplicateKeyError(err);
    }
    // Mongoose cast error (invalid ObjectID)
    else if (err.name === 'CastError') {
      appError = DatabaseError.fromCastError(err);
    }
    // JWT authentication errors
    else if (err.name && err.name.includes('Error') && err.name.includes('Token')) {
      appError = AuthenticationError.fromJWTError(err);
    }
    // Database connection errors
    else if (err.name === 'MongoNetworkError' || err.name === 'MongoConnectionError') {
      appError = DatabaseError.fromConnectionError(err);
    }
    // Timeout errors
    else if (err.name === 'MongooseServerSelectionError' || err.code === 'ECONNREFUSED') {
      appError = DatabaseError.fromTimeoutError(err);
    }
    // Express file upload errors
    else if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        appError = BadRequestError.fileSizeExceeded(
          err.field,
          err.limit,
          process.env.MAX_FILE_SIZE || 52428800
        );
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        appError = BadRequestError(
          'Too many files uploaded',
          'FILE_COUNT_EXCEEDED'
        );
      } else {
        appError = BadRequestError('File upload error', 'FILE_UPLOAD_ERROR', { detail: err.message });
      }
    }
    // JSON parsing errors
    else if (err instanceof SyntaxError && 'body' in err) {
      appError = BadRequestError.invalidBodyFormat('JSON');
    }
    // Generic error
    else {
      appError = new AppError(
        err.message || 'An unexpected error occurred',
        err.statusCode || 500,
        'UNEXPECTED_ERROR',
        { originalError: err.name }
      );
    }

    err = appError;
  }

  // Log the error
  const errorContext = {
    isOperational: err.isOperational,
    handledAs: err.constructor.name
  };
  logError(err, req, errorContext);

  // Track error in monitor for alerting and analytics
  errorMonitor.trackError(err.errorCode || 'UNEXPECTED_ERROR', {
    statusCode: err.statusCode || 500,
    message: err.message,
    method: req.method,
    path: req.path,
    userId: req.userId || req.landlordId || 'anonymous'
  });

  // Send response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json(formatErrorResponse(err, process.env.NODE_ENV === 'development'));
};

/**
 * Async handler wrapper - catches rejected promises in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  const error = NotFoundError.endpointNotFound(req.method, req.path);
  logError(error, req, { type: 'route_not_found' });
  res.status(404).json(formatErrorResponse(error));
};

/**
 * Error recovery helpers
 */
const errorRecovery = {
  /**
   * Retry failed operation with exponential backoff
   */
  async retryWithBackoff(operation, maxAttempts = 3, initialDelayMs = 100) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        // Exponential backoff: 100ms, 200ms, 400ms, etc.
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  },

  /**
   * Fallback value if operation fails
   */
  async getFallback(operation, fallbackValue = null) {
    try {
      return await operation();
    } catch (error) {
      logger.warn('Operation failed, using fallback', { error: error.message });
      return fallbackValue;
    }
  },

  /**
   * Circuit breaker pattern
   */
  createCircuitBreaker(operation, options = {}) {
    const {
      threshold = 5, // Failures before opening circuit
      timeout = 60000, // Time before attempting recovery (ms)
      resetTimeout = 30000 // Time to stay open (ms)
    } = options;

    let failureCount = 0;
    let lastFailureTime = null;
    let state = 'closed'; // closed, open, half-open

    return async function execute(...args) {
      if (state === 'open') {
        if (Date.now() - lastFailureTime > resetTimeout) {
          state = 'half-open';
        } else {
          throw new ServiceUnavailableError(
            'Service temporarily unavailable',
            { state: 'open', retryAfter: Math.ceil((lastFailureTime + resetTimeout - Date.now()) / 1000) }
          );
        }
      }

      try {
        const result = await operation(...args);
        
        if (state === 'half-open') {
          state = 'closed';
          failureCount = 0;
        }

        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = Date.now();

        if (failureCount >= threshold) {
          state = 'open';
            logger.error('Circuit breaker opened', { 
              operation: operation.name,
              failureCount,
              threshold
            });
        }

        throw error;
      }
    };
  }
};

module.exports = {
  enhancedErrorHandler,
  asyncHandler,
  notFoundHandler,
  formatErrorResponse,
  logError,
  errorRecovery
};
