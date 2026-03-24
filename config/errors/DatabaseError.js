/**
 * DatabaseError - For database operation failures
 * Used when MongoDB operations fail
 */
const AppError = require('./AppError');

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', errorCode = 'DB_ERROR', details = null) {
    super(message, 500, errorCode, details);
  }

  /**
   * Handle MongoDB duplicate key errors (E11000)
   */
  static fromDuplicateKeyError(mongooseError) {
    if (mongooseError.code !== 11000) {
      return null;
    }

    const field = Object.keys(mongooseError.keyValue)[0];
    const value = mongooseError.keyValue[field];

    return new DatabaseError(
      `${field} already exists in the system`,
      'DUPLICATE_KEY_ERROR',
      {
        field,
        value,
        operation: 'insert_or_update',
        constraint: 'unique'
      }
    );
  }

  /**
   * Handle MongoDB cast errors (invalid ObjectID format)
   */
  static fromCastError(mongooseError) {
    if (mongooseError.name !== 'CastError') {
      return null;
    }

    return new DatabaseError(
      'Invalid resource ID format',
      'INVALID_ID_FORMAT',
      {
        field: mongooseError.path,
        value: mongooseError.value,
        expectedType: mongooseError.kind,
        operation: 'query'
      }
    );
  }

  /**
   * Handle MongoDB connection errors
   */
  static fromConnectionError(error) {
    return new DatabaseError(
      'Database connection failed',
      'CONNECTION_ERROR',
      {
        message: error.message,
        code: error.code,
        retryable: error.retryable,
        operation: 'connection'
      }
    );
  }

  /**
   * Handle query timeout errors
   */
  static fromTimeoutError(error) {
    const statusCode = 503; // Service Unavailable

    return new DatabaseError(
      'Database query timed out',
      'QUERY_TIMEOUT',
      {
        message: error.message,
        timeout: error.timeout || 30000,
        operation: 'query'
      }
    );
  }

  /**
   * Create DatabaseError with custom details
   */
  static create(message, errorCode, details = {}) {
    return new DatabaseError(message, errorCode, details);
  }
}

module.exports = DatabaseError;
