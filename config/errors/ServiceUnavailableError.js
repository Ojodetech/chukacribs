/**
 * ServiceUnavailableError - For service unavailability errors
 * Used when external services or dependencies are down
 */
const AppError = require('./AppError');

class ServiceUnavailableError extends AppError {
  constructor(serviceName = 'Service', message = null, details = null) {
    const errorMessage = message || `${serviceName} is currently unavailable. Please try again later.`;
    super(errorMessage, 503, 'SERVICE_UNAVAILABLE', details || { serviceName });
  }

  /**
   * Database is down
   */
  static databaseDown(reason = null) {
    return new ServiceUnavailableError('Database', null, { reason, service: 'database' });
  }

  /**
   * Cache service is down
   */
  static cacheDown(reason = null) {
    return new ServiceUnavailableError('Cache', null, { reason, service: 'cache' });
  }

  /**
   * Email service is down
   */
  static emailServiceDown(reason = null) {
    return new ServiceUnavailableError('Email service', null, { reason, service: 'email' });
  }

  /**
   * Payment gateway is down
   */
  static paymentGatewayDown(reason = null) {
    return new ServiceUnavailableError('Payment gateway', null, { reason, service: 'payment' });
  }

  /**
   * SMS service is down
   */
  static smsServiceDown(reason = null) {
    return new ServiceUnavailableError('SMS service', null, { reason, service: 'sms' });
  }

  /**
   * External API is down
   */
  static externalApiDown(serviceName, reason = null) {
    return new ServiceUnavailableError(
      `${serviceName} API`,
      null,
      { reason, service: serviceName, external: true }
    );
  }

  /**
   * Server maintenance mode
   */
  static maintenanceMode(estimatedDuration = null) {
    return new ServiceUnavailableError(
      'Server',
      'The server is currently under maintenance. Please try again later.',
      { maintenance: true, estimatedDuration }
    );
  }

  /**
   * Resource is temporarily unavailable
   */
  static resourceUnavailable(resourceType, reason = null) {
    return new ServiceUnavailableError(
      `${resourceType}`,
      `${resourceType} is temporarily unavailable. Please try again later.`,
      { reason, resourceType }
    );
  }
}

module.exports = ServiceUnavailableError;
