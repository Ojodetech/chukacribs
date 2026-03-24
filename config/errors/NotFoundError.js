/**
 * NotFoundError - For resource not found errors
 * Used when requested resource doesn't exist
 */
const AppError = require('./AppError');

class NotFoundError extends AppError {
  constructor(resourceType = 'Resource', identifier = null, details = null) {
    const message = identifier 
      ? `${resourceType} with ${Object.keys(identifier)[0]} '${Object.values(identifier)[0]}' not found`
      : `${resourceType} not found`;

    super(message, 404, 'NOT_FOUND', details || { resourceType, identifier });
  }

  /**
   * Create NotFoundError for specific resource type
   */
  static create(resourceType, identifier = null) {
    return new NotFoundError(resourceType, identifier);
  }

  /**
   * House not found
   */
  static houseNotFound(houseId) {
    return new NotFoundError('House', { id: houseId });
  }

  /**
   * User not found
   */
  static userNotFound(userId) {
    return new NotFoundError('User', { id: userId });
  }

  /**
   * Booking not found
   */
  static bookingNotFound(bookingId) {
    return new NotFoundError('Booking', { id: bookingId });
  }

  /**
   * Payment not found
   */
  static paymentNotFound(paymentId) {
    return new NotFoundError('Payment', { id: paymentId });
  }

  /**
   * Landlord not found
   */
  static landlordNotFound(landlordId) {
    return new NotFoundError('Landlord', { id: landlordId });
  }

  /**
   * Endpoint not found
   */
  static endpointNotFound(method, path) {
    return new NotFoundError(
      'Endpoint',
      { method, path },
      { hint: `${method} ${path} does not exist` }
    );
  }
}

module.exports = NotFoundError;
