const express = require('express');
const { body, validationResult } = require('express-validator');
const Landlord = require('../models/Landlord');
const {
  sendVerificationCode,
  generateVerificationCode,
  sendSMS
} = require('../config/sms');
const { authenticateLandlord } = require('../config/auth');
const { handleValidationErrors, CustomValidators } = require('../config/validation');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Send phone verification code to landlord
 * POST /api/sms/send-verification-code
 */
router.post(
  '/send-verification-code',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('phone')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Invalid phone number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, phone } = req.body;

      // Find or check if landlord exists
      const landlord = await Landlord.findOne({ email });

      // Generate 6-digit code
      const verificationCode = generateVerificationCode(6);
      const codeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Send SMS
      const smsResult = await sendVerificationCode(phone, verificationCode);

      if (!smsResult.success) {
        logger.error(`Failed to send verification code to ${phone}`, smsResult);
        return res.status(500).json({
          message: 'Failed to send verification code. Please try again.',
          error: smsResult.reason
        });
      }

      // Store code in database if landlord exists
      if (landlord) {
        landlord.phoneVerificationCode = verificationCode;
        landlord.phoneVerificationExpiry = codeExpiry;
        await landlord.save();
      }

      logger.info(`Verification code sent to ${phone}`, { email, verificationCode });

      res.json({
        message: 'Verification code sent successfully',
        phone,
        expiresIn: '15 minutes',
        messageId: smsResult.messageId
      });
    } catch (err) {
      logger.error(`Error sending verification code: ${err.message}`);
      res.status(500).json({
        message: 'Error sending verification code',
        error: err.message
      });
    }
  }
);

/**
 * Verify phone number with code
 * POST /api/sms/verify-phone
 */
router.post(
  '/verify-phone',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('code')
      .trim()
      .isLength({ min: 6, max: 6 })
      .matches(/^\d+$/)
      .withMessage('Verification code must be 6 digits')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, code } = req.body;

      const landlord = await Landlord.findOne({ email });
      if (!landlord) {
        return res.status(404).json({ message: 'Landlord not found' });
      }

      // Check if code is expired
      if (new Date() > landlord.phoneVerificationExpiry) {
        return res.status(400).json({
          message: 'Verification code has expired. Please request a new one.'
        });
      }

      // Check if code matches
      if (landlord.phoneVerificationCode !== code) {
        return res.status(400).json({
          message: 'Invalid verification code'
        });
      }

      // Mark phone as verified
      landlord.phoneVerified = true;
      landlord.phoneVerificationCode = null;
      landlord.phoneVerificationExpiry = null;
      await landlord.save();

      logger.info(`Phone verified for landlord: ${email}`);

      res.json({
        message: 'Phone number verified successfully',
        phoneVerified: true
      });
    } catch (err) {
      logger.error(`Error verifying phone: ${err.message}`);
      res.status(500).json({
        message: 'Error verifying phone number',
        error: err.message
      });
    }
  }
);

/**
 * Send custom SMS (authenticated landlord only)
 * POST /api/sms/send
 */
router.post(
  '/send',
  authenticateLandlord,
  [
    body('phoneNumber')
      .trim()
      .matches(/^(\+?254|0)[17][0-9]{8}$/)
      .withMessage('Invalid phone number format (must be Kenya number)')
      .custom(CustomValidators.noNoSQLInjection),
    body('message')
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage('Message must be between 1 and 160 characters')
      .custom(CustomValidators.noXSS)
      .custom(CustomValidators.noNoSQLInjection)
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;

      // Send SMS
      const result = await sendSMS(phoneNumber, message);

      if (!result.success) {
        return res.status(500).json({
          message: 'Failed to send SMS',
          error: result.reason
        });
      }

      logger.info(`SMS sent by landlord ${req.landlordId} to ${phoneNumber}`);

      res.json({
        message: 'SMS sent successfully',
        messageId: result.messageId,
        phoneNumber: result.phoneNumber
      });
    } catch (err) {
      logger.error(`Error sending SMS: ${err.message}`);
      res.status(500).json({
        message: 'Error sending SMS',
        error: err.message
      });
    }
  }
);

/**
 * Get SMS verification status
 * GET /api/sms/verification-status
 */
router.get(
  '/verification-status',
  authenticateLandlord,
  async (req, res) => {
    try {
      const landlord = await Landlord.findById(req.landlordId);

      if (!landlord) {
        return res.status(404).json({ message: 'Landlord not found' });
      }

      res.json({
        phoneVerified: landlord.phoneVerified,
        phone: landlord.phone,
        lastVerificationTime: landlord.updatedAt
      });
    } catch (err) {
      logger.error(`Error fetching SMS status: ${err.message}`);
      res.status(500).json({
        message: 'Error fetching SMS verification status',
        error: err.message
      });
    }
  }
);

module.exports = router;
