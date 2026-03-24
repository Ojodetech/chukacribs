/**
 * Input Validation Utilities
 * Provides consistent, reusable validation patterns for all routes
 * Prevents XSS, NoSQL injection, and common attack vectors
 */

const { body, param, validationResult } = require('express-validator');
const validator = require('validator');

/**
 * Common validation patterns
 */
const ValidationPatterns = {
  // Email validation
  email: body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  // Password validation (strong)
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain number')
    .matches(/[!@#$%^&*]/)
    .withMessage('Password must contain special character (!@#$%^&*)'),

  // Phone number (Kenya format)
  phone: body('phone')
    .trim()
    .matches(/^(\+?254|0)[17][0-9]{8}$/)
    .withMessage('Invalid phone number format (must be Kenya number)'),

  // Name validation
  name: body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  // Text validation (general)
  text: (fieldName, minLength = 1, maxLength = 5000) =>
    body(fieldName)
      .trim()
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${fieldName} must be ${minLength}-${maxLength} characters`)
      .escape(),

  // URL validation
  url: body('url')
    .trim()
    .isURL()
    .withMessage('Invalid URL'),

  // Number validation
  number: (fieldName, options = {}) => {
    const { min = 0, max = null, int = false } = options;
    const validator = body(fieldName)
      .isNumeric()
      .withMessage(`${fieldName} must be a number`)
      .custom((value) => {
        if (int && !Number.isInteger(Number(value))) {
          throw new Error(`${fieldName} must be an integer`);
        }
        if (value < min) {
          throw new Error(`${fieldName} must be at least ${min}`);
        }
        if (max && value > max) {
          throw new Error(`${fieldName} must not exceed ${max}`);
        }
        return true;
      });
    return validator;
  },

  // MongoDB ObjectId
  objectId: (fieldName) =>
    param(fieldName)
      .isMongoId()
      .withMessage(`Invalid ${fieldName} format`),

  // Enum validation
  enum: (fieldName, validValues) =>
    body(fieldName)
      .isIn(validValues)
      .withMessage(
        `${fieldName} must be one of: ${validValues.join(', ')}`
      ),

  // Date validation
  date: body('date')
    .isISO8601()
    .withMessage('Invalid date format (use ISO 8601)'),

  // Boolean validation
  boolean: body('boolean')
    .isBoolean()
    .withMessage('Must be true or false'),

  // Array validation
  array: (fieldName) =>
    body(fieldName)
      .isArray()
      .withMessage(`${fieldName} must be an array`),

  // Price/money validation (Kenyan Shillings)
  price: body('price')
    .isFloat({ min: 0.01, max: 9999999 })
    .withMessage('Price must be between 0.01 and 9,999,999 KES')
    .toFloat(),

  // Booking amount (must be divisible by 100 for M-Pesa)
  bookingAmount: body('amount')
    .isInt({ min: 100 })
    .withMessage('Booking amount must be at least 100 KES')
    .custom((value) => {
      if (value % 100 !== 0) {
        throw new Error('Amount must be divisible by 100');
      }
      return true;
    })
    .toInt(),
};

/**
 * Sanitization patterns
 */
const Sanitizers = {
  // HTML sanitization
  sanitizeHtml: body('html').trim().escape(),

  // String sanitization
  sanitizeString: (fieldName) => body(fieldName).trim().escape(),

  // Email sanitization
  sanitizeEmail: (fieldName) =>
    body(fieldName).trim().toLowerCase().normalizeEmail(),

  // URL sanitization
  sanitizeUrl: (fieldName) => body(fieldName).trim().isURL().escape(),
};

/**
 * Middleware to check validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation failure for security monitoring
    req.logger?.warn('Validation failed', {
      errors: errors.array().map((e) => ({
        field: e.param,
        message: e.msg,
      })),
      ip: req.ip,
      path: req.path,
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().reduce((acc, error) => {
        acc[error.param] = error.msg;
        return acc;
      }, {}),
    });
  }
  next();
};

/**
 * Custom validators
 */
const CustomValidators = {
  // Validate landlord exists
  landlordExists: async (landlordId) => {
    const Landlord = require('../models/Landlord');
    const landlord = await Landlord.findById(landlordId);
    if (!landlord) {
      throw new Error('Landlord not found');
    }
  },

  // Validate house exists
  houseExists: async (houseId) => {
    const House = require('../models/House');
    const house = await House.findById(houseId);
    if (!house) {
      throw new Error('House not found');
    }
  },

  // Validate no XSS payloads
  noXSS: (value) => {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];
    if (xssPatterns.some((pattern) => pattern.test(value))) {
      throw new Error('Invalid characters detected');
    }
    return true;
  },

  // Validate no NoSQL injection
  noNoSQLInjection: (value) => {
    if (typeof value === 'object' && value !== null) {
      throw new Error('Nested objects not allowed');
    }
    const injectionPatterns = [
      /\$where/i,
      /\$ne:/i,
      /\$gt:/i,
      /\$regex/i,
      /\{.*\$/,
    ];
    if (injectionPatterns.some((pattern) => pattern.test(String(value)))) {
      throw new Error('Suspicious operator detected');
    }
    return true;
  },
};

/**
 * Predefined endpoint validators (ready-to-use)
 */
const EndpointValidators = {
  // User registration
  registerUser: [
    ValidationPatterns.email,
    ValidationPatterns.password,
    ValidationPatterns.name,
    ValidationPatterns.phone,
    handleValidationErrors,
  ],

  // User login
  loginUser: [
    ValidationPatterns.email,
    body('password').isLength({ min: 1 }).withMessage('Password required'),
    handleValidationErrors,
  ],

  // Landlord registration
  registerLandlord: [
    ValidationPatterns.email,
    ValidationPatterns.password,
    ValidationPatterns.name,
    ValidationPatterns.phone,
    body('businessName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Business name must be 2-100 characters'),
    handleValidationErrors,
  ],

  // Create booking
  createBooking: [
    ValidationPatterns.objectId('houseId'),
    body('userEmail').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('userName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be 2-100 characters'),
    ValidationPatterns.phone,
    ValidationPatterns.bookingAmount,
    body('startDate')
      .isISO8601()
      .withMessage('Invalid start date'),
    handleValidationErrors,
  ],

  // Create property listing
  createProperty: [
    body('title')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be 5-200 characters'),
    body('location')
      .trim()
      .isLength({ min: 5, max: 100 })
      .withMessage('Location must be 5-100 characters'),
    ValidationPatterns.price,
    body('bedrooms')
      .isInt({ min: 1, max: 50 })
      .withMessage('Bedrooms must be 1-50'),
    body('bathrooms')
      .isInt({ min: 1, max: 50 })
      .withMessage('Bathrooms must be 1-50'),
    body('description')
      .trim()
      .isLength({ min: 20, max: 5000 })
      .withMessage('Description must be 20-5000 characters'),
    body('type')
      .isIn(['apartment', 'house', 'room', 'bedsitter'])
      .withMessage('Invalid property type'),
    body('amenities')
      .optional()
      .isArray()
      .withMessage('Amenities must be an array'),
    handleValidationErrors,
  ],

  // Update profile
  updateProfile: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be 2-100 characters'),
    body('phone')
      .optional()
      .matches(/^(\+?254|0)[17][0-9]{8}$/)
      .withMessage('Invalid phone number'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must not exceed 500 characters'),
    handleValidationErrors,
  ],
};

module.exports = {
  ValidationPatterns,
  Sanitizers,
  CustomValidators,
  EndpointValidators,
  handleValidationErrors,
};
