/**
 * ConflictError - For resource conflict errors
 * Used when request conflicts with existing data or state
 */
const AppError = require('./AppError');

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', errorCode = 'CONFLICT', details = null) {
    super(message, 409, errorCode, details);
  }

  /**
   * Resource already exists
   */
  static alreadyExists(resourceType, field, value) {
    return new ConflictError(
      `${resourceType} with ${field} '${value}' already exists`,
      'RESOURCE_ALREADY_EXISTS',
      { resourceType, field, value }
    );
  }

  /**
   * Duplicate entry
   */
  static duplicateEntry(field = null) {
    return new ConflictError(
      field ? `${field} already exists` : 'This entry already exists',
      'DUPLICATE_ENTRY',
      { field }
    );
  }

  /**
   * Invalid state transition
   */
  static invalidStateTransition(currentState, requestedState) {
    return new ConflictError(
      `Cannot transition from ${currentState} to ${requestedState}`,
      'INVALID_STATE_TRANSITION',
      { currentState, requestedState }
    );
  }

  /**
   * Resource already in use
   */
  static resourceInUse(resourceType, reason = null) {
    return new ConflictError(
      `${resourceType} is already in use`,
      'RESOURCE_IN_USE',
      { resourceType, reason }
    );
  }

  /**
   * Booking conflict (overlapping dates)
   */
  static bookingConflict(reason = 'Dates overlap with existing booking', conflictingBooking = null) {
    return new ConflictError(
      reason,
      'BOOKING_CONFLICT',
      { conflictingBooking }
    );
  }

  /**
   * Email already registered
   */
  static emailExists(email) {
    return new ConflictError(
      'This email is already registered',
      'EMAIL_EXISTS',
      { email, field: 'email' }
    );
  }

  /**
   * Username already taken
   */
  static usernameExists(username) {
    return new ConflictError(
      'This username is already taken',
      'USERNAME_EXISTS',
      { username, field: 'username' }
    );
  }
}

module.exports = ConflictError;
