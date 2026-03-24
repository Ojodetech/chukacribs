/**
 * Error Classes Index
 * Central export point for all custom error types
 */

const AppError = require('./AppError');
const ValidationError = require('./ValidationError');
const DatabaseError = require('./DatabaseError');
const AuthenticationError = require('./AuthenticationError');
const AuthorizationError = require('./AuthorizationError');
const NotFoundError = require('./NotFoundError');
const ConflictError = require('./ConflictError');
const BadRequestError = require('./BadRequestError');
const RateLimitError = require('./RateLimitError');
const ServiceUnavailableError = require('./ServiceUnavailableError');

module.exports = {
  AppError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  RateLimitError,
  ServiceUnavailableError
};
