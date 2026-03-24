/**
 * ValidationError - For validation failures
 * Used when request body or query parameters fail validation
 */
const AppError = require('./AppError');

class ValidationError extends AppError {
  constructor(message = 'Validation failed', validationErrors = []) {
    const details = Array.isArray(validationErrors) 
      ? validationErrors.map(err => ({
          field: err.field || err.param || err.path,
          message: err.message || err.msg,
          value: err.value,
          rule: err.rule || null
        }))
      : validationErrors;

    super(message, 400, 'VALIDATION_ERROR', details);
  }

  /**
   * Create ValidationError from express-validator errors
   */
  static fromValidationResult(errors) {
    return new ValidationError(
      'Request validation failed',
      errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value,
        rule: err.rule
      }))
    );
  }

  /**
   * Create ValidationError from Mongoose validation error
   */
  static fromMongooseError(mongooseError) {
    if (mongooseError.name !== 'ValidationError') {
      return null;
    }

    const errorDetails = Object.entries(mongooseError.errors).map(([field, error]) => ({
      field,
      message: error.message,
      value: error.value,
      rule: error.kind
    }));

    return new ValidationError('Database validation failed', errorDetails);
  }

  /**
   * Create ValidationError from schema.validate() errors
   */
  static fromSchemaValidation(schemaError) {
    const errorDetails = (schemaError.details || []).map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context.value,
      rule: err.type
    }));

    return new ValidationError('Schema validation failed', errorDetails);
  }
}

module.exports = ValidationError;
