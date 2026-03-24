/**
 * AppError - Base custom error class for the application
 * All application-specific errors should extend this class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    
    // Set the prototype explicitly to support instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // For distinguishing operational errors from programming errors

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      // Include stack trace only in development
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    return this.message;
  }

  /**
   * Get technical error details for logging
   */
  getTechnicalDetails() {
    return {
      errorCode: this.errorCode,
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
      stack: this.stack,
      timestamp: this.timestamp
    };
  }
}

module.exports = AppError;
