/**
 * BadRequestError - For malformed or invalid requests
 * Used when request format or parameters are invalid
 */
const AppError = require('./AppError');

class BadRequestError extends AppError {
  constructor(message = 'Bad request', errorCode = 'BAD_REQUEST', details = null) {
    super(message, 400, errorCode, details);
  }

  /**
   * Missing required field
   */
  static missingRequired(fieldName) {
    return new BadRequestError(
      `${fieldName} is required`,
      'MISSING_REQUIRED_FIELD',
      { field: fieldName }
    );
  }

  /**
   * Invalid request body format
   */
  static invalidBodyFormat(expectedFormat = null) {
    return new BadRequestError(
      'Request body format is invalid',
      'INVALID_BODY_FORMAT',
      { expectedFormat, hint: 'Please ensure request body is valid JSON' }
    );
  }

  /**
   * Invalid query parameters
   */
  static invalidQueryParams(details = null) {
    return new BadRequestError(
      'Invalid query parameters',
      'INVALID_QUERY_PARAMS',
      details
    );
  }

  /**
   * Invalid payment method
   */
  static invalidPaymentMethod(method, supportedMethods = []) {
    return new BadRequestError(
      `Payment method '${method}' is not supported`,
      'INVALID_PAYMENT_METHOD',
      { method, supportedMethods }
    );
  }

  /**
   * Insufficient balance
   */
  static insufficientBalance(required, available) {
    return new BadRequestError(
      'Insufficient balance for this transaction',
      'INSUFFICIENT_BALANCE',
      { required, available, shortage: required - available }
    );
  }

  /**
   * Invalid date range
   */
  static invalidDateRange(startDate, endDate, reason = null) {
    return new BadRequestError(
      'Invalid date range',
      'INVALID_DATE_RANGE',
      { startDate, endDate, reason }
    );
  }

  /**
   * File size exceeded
   */
  static fileSizeExceeded(fileName, fileSize, maxSize) {
    return new BadRequestError(
      `File '${fileName}' exceeds maximum size of ${maxSize} bytes`,
      'FILE_SIZE_EXCEEDED',
      { fileName, fileSize, maxSize, excess: fileSize - maxSize }
    );
  }

  /**
   * Unsupported file type
   */
  static unsupportedFileType(fileName, fileType, supportedTypes = []) {
    return new BadRequestError(
      `File type '${fileType}' is not supported`,
      'UNSUPPORTED_FILE_TYPE',
      { fileName, fileType, supportedTypes }
    );
  }
}

module.exports = BadRequestError;
