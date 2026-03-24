/**
 * RateLimitError - For rate limit exceeded errors
 * Used when request rate limit is exceeded
 */
const AppError = require('./AppError');

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = null) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }

  /**
   * Create with retry information
   */
  static create(message, retryAfterSeconds = null) {
    return new RateLimitError(message, retryAfterSeconds);
  }

  /**
   * API rate limit exceeded
   */
  static apiLimitExceeded(limit, window = '1 hour', retryAfter = null) {
    return new RateLimitError(
      `You have exceeded the API rate limit of ${limit} requests per ${window}. Please try again later.`,
      retryAfter
    );
  }

  /**
   * Login attempts exceeded
   */
  static loginAttemptsExceeded(attemptsAllowed = 5, lockoutMinutes = 15, retryAfter = null) {
    return new RateLimitError(
      `Too many login attempts. Maximum ${attemptsAllowed} attempts allowed. Your account will be unlocked in ${lockoutMinutes} minutes.`,
      retryAfter
    );
  }

  /**
   * Email verification requests exceeded
   */
  static emailVerificationLimitExceeded(limit = 3, window = '1 day', retryAfter = null) {
    return new RateLimitError(
      `Too many verification emails sent. Maximum ${limit} emails allowed per ${window}. Please try again later.`,
      retryAfter
    );
  }

  /**
   * SMS rate limit exceeded
   */
  static smsLimitExceeded(limit = 5, window = '1 hour', retryAfter = null) {
    return new RateLimitError(
      `Too many SMS messages sent. Maximum ${limit} messages allowed per ${window}. Please try again later.`,
      retryAfter
    );
  }

  /**
   * Payment request limit exceeded
   */
  static paymentLimitExceeded(limit, range = 'day', retryAfter = null) {
    return new RateLimitError(
      `Too many payment requests. Maximum ${limit} payments allowed per ${range}. Please try again later.`,
      retryAfter
    );
  }
}

module.exports = RateLimitError;
