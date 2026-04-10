const express = require('express');
const { body, validationResult } = require('express-validator');
const { initiateSTKPush, queryTransactionStatus } = require('../config/mpesa');
const Token = require('../models/Token');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Format phone number for M-Pesa
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return null;

  // Remove spaces, dashes, etc
  phone = phone.toString().replace(/\D/g, '');

  // Handle 07XXXXXXXX
  if (phone.startsWith('0') && phone.length === 10) {
    return '254' + phone.substring(1);
  }

  // Handle 7XXXXXXXX
  if (phone.length === 9 && phone.startsWith('7')) {
    return '254' + phone;
  }

  // Handle +254XXXXXXXXX
  if (phone.startsWith('254') && phone.length === 12) {
    return phone;
  }

  // Invalid format
  throw new Error('Invalid phone number format');
};

/**
 * POST /api/payment/initiate
 * Initiates M-Pesa payment for 24-hour access token
 * Body: { phoneNumber: string }
 */
router.post(
  '/initiate',
  [
    body('phoneNumber')
      .trim()
      .matches(/^(\+?254|0)[1-9]\d{8}$/)
      .withMessage('Invalid Kenyan phone number format')
  ],
  async (req, res) => {
    try {
      logger.info('STK Push request received', {
        phoneNumber: req.body.phoneNumber,
        ip: req.ip
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation errors', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { phoneNumber } = req.body;
      const amount = process.env.PAYMENT_AMOUNT || 100;

      // Generate order ID
      const orderId = `TOKEN_${Date.now()}`;

      // Initiate M-Pesa STK push
      const result = await initiateSTKPush(phoneNumber, amount, orderId);

      if (!result.success) {
        logger.error('STK Push failed', { error: result.error, phoneNumber });
        return res.status(400).json({
          success: false,
          message: 'Failed to initiate payment',
          error: result.error
        });
      }

      // Create token in database
      const tokenData = new Token({
        token: `tok_${Math.random().toString(36).substr(2, 18)}`,
        referenceId: orderId,
        orderTrackingId: result.checkoutRequestId,
        phoneNumber,
        amount,
        paymentStatus: 'pending',
        paymentGateway: 'mpesa',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      });
      await tokenData.save();

      logger.info('Payment initiated', { referenceId: orderId, checkoutRequestId: result.checkoutRequestId });

      res.status(200).json({
        success: true,
        message: 'Payment prompt sent to your phone',
        checkoutRequestId: result.checkoutRequestId,
        amount: amount,
        currency: 'KES'
      });
    } catch (error) {
      logger.error('Payment initiation error', { error: error.message, phoneNumber: req.body?.phoneNumber });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /api/payment/query
 * Query the status of a payment transaction
 * Body: { checkoutRequestId: string }
 */
router.post(
  '/query',
  [
    body('checkoutRequestId')
      .trim()
      .notEmpty()
      .withMessage('Checkout request ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { checkoutRequestId } = req.body;

      const result = await queryTransactionStatus(checkoutRequestId);

      res.status(200).json({
        success: result.success,
        message: result.message,
        resultCode: result.resultCode,
        resultDesc: result.resultDesc
      });
    } catch (error) {
      logger.error('Payment query error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /api/payment/callback
 * M-Pesa STK callback endpoint
 * Handles payment confirmation from M-Pesa
 */
router.post('/callback', async (req, res) => {
  try {
    // Handle empty body (connectivity test)
    if (Object.keys(req.body).length === 0) {
      logger.info('M-Pesa connectivity test received');
      return res.status(200).json({ status: 'ok', message: 'Endpoint is reachable' });
    }

    let stkCallback;
    
    // Check for nested Body.stkCallback structure
    if (req.body.Body && req.body.Body.stkCallback) {
      stkCallback = req.body.Body.stkCallback;
    }
    // Check for root-level stkCallback
    else if (req.body.stkCallback) {
      stkCallback = req.body.stkCallback;
    }
    // Check if entire body IS the stkCallback
    else if (req.body.CheckoutRequestID) {
      stkCallback = req.body;
    }
    else {
      logger.warn('Invalid callback structure', { bodyKeys: Object.keys(req.body) });
      return res.status(200).json({ success: false, message: 'Invalid callback' });
    }

    logger.info('Callback received', {
      checkoutId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode
    });

    // Check if payment was successful
    if (stkCallback.ResultCode !== 0) {
      logger.warn('Payment failed', {
        resultCode: stkCallback.ResultCode,
        resultDesc: stkCallback.ResultDesc,
        checkoutId: stkCallback.CheckoutRequestID
      });
      return res.status(200).json({ success: false });
    }

    // Extract payment metadata safely
    const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
    const paymentData = {};

    callbackMetadata.forEach(item => {
      if (item.Name === 'Amount') paymentData.amount = item.Value;
      if (item.Name === 'MpesaReceiptNumber') paymentData.mpesaReceiptNumber = item.Value;
      if (item.Name === 'TransactionDate') paymentData.transactionDate = item.Value;
      if (item.Name === 'PhoneNumber') paymentData.phoneNumber = formatPhoneNumber(item.Value);
    });

    const checkoutRequestId = stkCallback.CheckoutRequestID;

    // Update token
    const token = await Token.findOneAndUpdate(
      { orderTrackingId: checkoutRequestId },
      {
        phoneNumber: paymentData.phoneNumber || undefined,
        amount: paymentData.amount || undefined,
        mpesaReceiptNumber: paymentData.mpesaReceiptNumber || undefined,
        paymentStatus: 'completed',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      { new: true }
    );

    if (!token) {
      logger.error('Token not found for callback', { checkoutRequestId });
      return res.status(200).json({ success: false, message: 'Token not found' });
    }

    logger.info('Payment completed', {
      tokenId: token._id,
      checkoutId: checkoutRequestId,
      amount: paymentData.amount
    });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Callback processing error', { error: error.message });
    res.status(200).json({ success: false, message: 'Processing error' });
  }
});

/**
 * Shared handler for C2B validation links
 */
const c2bValidationHandler = async (req, res) => {
  try {
    logger.info('C2B validation request received', { body: req.body });
    // Add business-specific checks here if needed.
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error('C2B validation error', { error: error.message, stack: error.stack });
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

/**
 * Shared handler for C2B confirmation links
 */
const c2bConfirmationHandler = async (req, res) => {
  try {
    logger.info('C2B confirmation received', { body: req.body });
    // Optional: store confirmation payload for reconciliation.
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error('C2B confirmation processing error', { error: error.message, stack: error.stack });
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

/**
 * POST /mpesa-validation
 * Safaricom C2B validation URL
 */
router.post('/mpesa-validation', c2bValidationHandler);
router.post('/validation', c2bValidationHandler);
router.post('/c2b-validation', c2bValidationHandler);

/**
 * POST /mpesa-confirmation
 * Safaricom C2B confirmation URL
 */
router.post('/mpesa-confirmation', c2bConfirmationHandler);
router.post('/confirmation', c2bConfirmationHandler);
router.post('/c2b-confirmation', c2bConfirmationHandler);

/**
 * POST /api/payment/poll-status
 * Poll payment status by checking M-Pesa directly
 * Useful for frontend to check if user completed payment
 * Body: { checkoutRequestId: string }
 * Note: Throttled to prevent abuse - recommend frontend polling every 5-10 seconds
 */
router.post(
  '/poll-status',
  [
    body('checkoutRequestId')
      .trim()
      .notEmpty()
      .withMessage('Checkout request ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { checkoutRequestId } = req.body;

      // Simple throttling: allow one poll per checkoutRequestId every 5 seconds
      const now = Date.now();
      const throttleKey = `poll_${checkoutRequestId}`;
      if (global[throttleKey] && now - global[throttleKey] < 5000) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please wait before polling again.'
        });
      }
      global[throttleKey] = now;

      const result = await queryTransactionStatus(checkoutRequestId);

      res.status(200).json({
        success: result.success,
        status: result.responseCode === '0' ? 'completed' : 'pending',
        message: result.message,
        responseCode: result.responseCode,
        resultCode: result.resultCode
      });
    } catch (error) {
      logger.error('Payment poll-status error', { error: error.message, checkoutRequestId: req.body.checkoutRequestId });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /api/payment/test-mock-callback
 * TEST ONLY - Simulate M-Pesa callback for testing
 * Only works in development/sandbox
 * Body: { checkoutRequestId: string, phoneNumber: string, amount: number, receiptNumber: string }
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-mock-callback', async (req, res) => {
    try {
      const { checkoutRequestId, phoneNumber, amount, receiptNumber } = req.body;

      if (!checkoutRequestId || !phoneNumber || !amount) {
        return res.status(400).json({
          error: 'Missing required fields: checkoutRequestId, phoneNumber, amount'
        });
      }

      logger.info('TEST: Mock M-Pesa callback triggered', {
        checkoutRequestId,
        phoneNumber,
        amount
      });

      // Create or update token
      const token = await Token.findOneAndUpdate(
        { orderTrackingId: checkoutRequestId },
        {
          phoneNumber: formatPhoneNumber(phoneNumber),
          amount: parseFloat(amount),
          mpesaReceiptNumber: receiptNumber || `TEST${  Date.now()}`,
          paymentStatus: 'completed',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          paymentGateway: 'mpesa'
        },
        { new: true, upsert: true }
      );

      res.status(200).json({
        success: true,
        message: 'Mock callback processed successfully',
        token: {
          id: token._id,
          phoneNumber: token.phoneNumber,
          amount: token.amount,
          status: token.paymentStatus,
          expiresAt: token.expiresAt
        }
      });
    } catch (error) {
      logger.error('Mock callback error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

/**
 * GET /api/payment/test-initiate-flow
 * TEST ONLY - Returns sample STK push request format
 * Helps developers understand the flow
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/test-initiate-flow', (req, res) => {
    res.status(200).json({
      documentation: 'Sample M-Pesa STK Push Flow',
      step1_initiate: {
        endpoint: 'POST /api/payment/initiate',
        body: {
          phoneNumber: '0712345678'
        },
        response: {
          success: true,
          message: 'Payment prompt sent to your phone',
          checkoutRequestId: 'ws_co_xxxxxxxxxxxxxxxxxxxx',
          amount: 100,
          currency: 'KES'
        }
      },
      step2_user_completes_payment: {
        description: 'User enters M-Pesa PIN on their phone'
      },
      step3_mpesa_callback: {
        endpoint: 'POST /api/payment/mpesa-callback',
        description: 'M-Pesa servers call this endpoint with payment result'
      },
      step4_frontend_polls: {
        endpoint: 'POST /api/payment/poll-status',
        body: { checkoutRequestId: 'ws_co_xxxxxxxxxxxxxxxxxxxx' },
        response: {
          success: true,
          status: 'completed',
          message: 'Success. Transaction is successful.',
          responseCode: '0'
        }
      },
      step5_frontend_verifies: {
        endpoint: 'GET /api/payment/verify/:phoneNumber',
        response: {
          hasAccess: true,
          token: '_id_of_token',
          expiresAt: '2026-02-07T12:00:00.000Z'
        }
      }
    });
  });
}
router.get('/verify/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const formattedPhone = formatPhoneNumber(phoneNumber);

    const token = await Token.findOne({
      phoneNumber: formattedPhone,
      paymentStatus: 'completed',
      expiresAt: { $gt: new Date() }
    });

    if (!token) {
      logger.info('Token verification failed - no valid token', {
        phoneNumber: formattedPhone
      });
      return res.status(404).json({
        hasAccess: false,
        message: 'No valid access token found'
      });
    }

    logger.info('Token verified successfully', {
      tokenId: token._id,
      phoneNumber: formattedPhone,
      expiresAt: token.expiresAt
    });

    res.status(200).json({
      hasAccess: true,
      token: token._id,
      expiresAt: token.expiresAt,
      remainingTime: `${Math.round((token.expiresAt - new Date()) / 1000 / 60)  } minutes`,
      message: 'Valid access token'
    });
  } catch (error) {
    logger.error('Token verification error', { error: error.message });
    res.status(500).json({
      hasAccess: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
