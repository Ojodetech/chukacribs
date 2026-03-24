/**
 * AuthenticationError - For authentication failures
 * Used for login, token validation, and authorization failures
 */
const AppError = require('./AppError');

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', errorCode = 'AUTH_ERROR', details = null) {
    super(message, 401, errorCode, details);
  }

  /**
   * Invalid credentials (wrong password, user not found)
   */
  static invalidCredentials() {
    return new AuthenticationError(
      'Invalid email or password',
      'INVALID_CREDENTIALS'
    );
  }

  /**
   * Invalid or malformed token
   */
  static invalidToken(error = null) {
    return new AuthenticationError(
      'Invalid authentication token',
      'INVALID_TOKEN',
      error ? { reason: error.message } : null
    );
  }

  /**
   * Token expired
   */
  static tokenExpired(expiryTime = null) {
    return new AuthenticationError(
      'Authentication token has expired',
      'TOKEN_EXPIRED',
      expiryTime ? { expiryTime } : null
    );
  }

  /**
   * Token not provided
   */
  static noToken() {
    return new AuthenticationError(
      'Authentication token not provided',
      'NO_TOKEN',
      { hint: 'Please provide a valid authentication token in headers' }
    );
  }

  /**
   * User not found
   */
  static userNotFound(identifier = null) {
    return new AuthenticationError(
      'User not found',
      'USER_NOT_FOUND',
      identifier ? { identifier } : null
    );
  }

  /**
   * User account disabled
   */
  static userDisabled(reason = null) {
    return new AuthenticationError(
      'User account is disabled',
      'USER_DISABLED',
      reason ? { reason } : null
    );
  }

  /**
   * Email not verified
   */
  static emailNotVerified() {
    return new AuthenticationError(
      'Email has not been verified',
      'EMAIL_NOT_VERIFIED',
      { hint: 'Please verify your email to continue' }
    );
  }

  /**
   * Handle JWT errors from jsonwebtoken library
   */
  static fromJWTError(error) {
    if (error.name === 'TokenExpiredError') {
      return AuthenticationError.tokenExpired(error.expiredAt);
    }
    if (error.name === 'JsonWebTokenError') {
      return AuthenticationError.invalidToken(error);
    }
    if (error.name === 'NotBeforeError') {
      return new AuthenticationError(
        'Token is not yet valid',
        'TOKEN_NOT_VALID_YET',
        { notBefore: error.date }
      );
    }
    return AuthenticationError.invalidToken(error);
  }
}

module.exports = AuthenticationError;
