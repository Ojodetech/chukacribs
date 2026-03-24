/**
 * AuthorizationError - For authorization/permission failures
 * Used when authenticated user doesn't have required permissions
 */
const AppError = require('./AppError');

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', errorCode = 'FORBIDDEN', details = null) {
    super(message, 403, errorCode, details);
  }

  /**
   * User doesn't have required role
   */
  static insufficientRole(requiredRole, userRole = null) {
    return new AuthorizationError(
      `You need ${requiredRole} role to access this resource`,
      'INSUFFICIENT_ROLE',
      { requiredRole, userRole }
    );
  }

  /**
   * User doesn't have required permission
   */
  static insufficientPermission(requiredPermission) {
    return new AuthorizationError(
      `You don't have permission to perform this action`,
      'INSUFFICIENT_PERMISSION',
      { requiredPermission }
    );
  }

  /**
   * Resource belongs to different user
   */
  static resourceNotOwned(resourceType = 'resource') {
    return new AuthorizationError(
      `You don't have permission to access this ${resourceType}`,
      'RESOURCE_NOT_OWNED',
      { resourceType }
    );
  }

  /**
   * Action not allowed for resource state
   */
  static actionNotAllowed(action, reason = null) {
    return new AuthorizationError(
      `You cannot ${action} this resource`,
      'ACTION_NOT_ALLOWED',
      { action, reason }
    );
  }

  /**
   * Payment required
   */
  static paymentRequired(reason = null) {
    const error = new AuthorizationError(
      'Payment required to access this resource',
      'PAYMENT_REQUIRED'
    );
    error.statusCode = 402; // Payment Required HTTP status
    if (reason) error.details = { reason };
    return error;
  }

  /**
   * Subscription required
   */
  static subscriptionRequired(planRequired = null) {
    return new AuthorizationError(
      'Active subscription required to access this resource',
      'SUBSCRIPTION_REQUIRED',
      { planRequired }
    );
  }

  /**
   * Quota exceeded
   */
  static quotaExceeded(quotaType, limit, current) {
    return new AuthorizationError(
      `You have exceeded your ${quotaType} quota`,
      'QUOTA_EXCEEDED',
      { quotaType, limit, current, used: current }
    );
  }
}

module.exports = AuthorizationError;
