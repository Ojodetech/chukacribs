const express = require('express');
const { body, validationResult } = require('express-validator');
const { initiateSTKPush, queryTransactionStatus, formatPhoneNumber } = require('../config/mpesa');
const Token = require('../models/Token');
const logger = require('../config/logger');

const router = express.Router();

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
      console.log('🔄 STK Push request received:', {
        phoneNumber: req.body.phoneNumber,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { phoneNumber } = req.body;
      const amount = process.env.PAYMENT_AMOUNT || 100;

      console.log('💰 Initiating payment:', {
        phoneNumber,
        amount,
        nodeEnv: process.env.NODE_ENV,
        useMockMpesa: process.env.USE_MOCK_MPESA
      });

      // Generate order ID
      const orderId = `TOKEN_${Date.now()}`;

      // Initiate M-Pesa STK push
      const result = await initiateSTKPush(phoneNumber, amount, orderId);

      console.log('📱 STK Push result:', {
        success: result.success,
        checkoutRequestId: result.checkoutRequestId,
        error: result.error,
        responseCode: result.responseCode
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to initiate payment',
          error: result.error
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payment prompt sent to your phone',
        checkoutRequestId: result.checkoutRequestId,
        amount: amount,
        currency: 'KES'
      });
    } catch (error) {
      console.error('❌ Payment initiation error:', {
        message: error.message,
        stack: error.stack,
        phoneNumber: req.body?.phoneNumber
      });
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
      console.error('Payment query error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /api/payment/mpesa-callback
 * M-Pesa callback endpoint for payment confirmation
 * Called by M-Pesa servers after payment completion
 */
router.post('/mpesa-callback', async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      logger.warn('Invalid M-Pesa callback structure', { body: req.body });
      return res.status(200).json({ success: false, message: 'Invalid callback' });
    }

    const stkCallback = Body.stkCallback;
    logger.info('M-Pesa Callback received', {
      checkoutId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc
    });

    // Check if payment was successful (ResultCode 0 = success)
    if (stkCallback.ResultCode !== 0) {
      logger.warn(`Payment failed with code: ${stkCallback.ResultCode}`, {
        resultDesc: stkCallback.ResultDesc,
        checkoutId: stkCallback.CheckoutRequestID
      });
      return res.status(200).json({ success: false });
    }

    // Extract payment metadata
    const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
    const paymentData = {};

    callbackMetadata.forEach(item => {
      if (item.Name === 'Amount') {paymentData.amount = item.Value;}
      if (item.Name === 'MpesaReceiptNumber') {paymentData.mpesaReceiptNumber = item.Value;}
      if (item.Name === 'TransactionDate') {paymentData.transactionDate = item.Value;}
      if (item.Name === 'PhoneNumber') {paymentData.phoneNumber = formatPhoneNumber(item.Value);}
    });

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;

    // Find token by checkoutRequestId and update it
    const token = await Token.findOneAndUpdate(
      { orderTrackingId: checkoutRequestId },
      {
        phoneNumber: paymentData.phoneNumber,
        amount: paymentData.amount,
        mpesaReceiptNumber: paymentData.mpesaReceiptNumber,
        paymentStatus: 'completed',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        paymentGateway: 'mpesa'
      },
      { new: true }
    );

    if (!token) {
      logger.error('Token not found for callback', {
        checkoutRequestId,
        phoneNumber: paymentData.phoneNumber
      });
      return res.status(200).json({ success: false, message: 'Token not found' });
    }

    logger.info('Payment completed successfully', {
      tokenId: token._id,
      checkoutId: checkoutRequestId,
      amount: paymentData.amount,
      phone: paymentData.phoneNumber
    });

    // Return success to M-Pesa
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('M-Pesa callback processing error', {
      error: error.message,
      stack: error.stack
    });
    res.status(200).json({ success: false, message: 'Processing error' });
  }
});

/**
 * POST /api/payment/callback
 * Alias for M-Pesa callback endpoint (without 'mpesa' in URL)
 * Handles both nested (Body.stkCallback) and root-level stkCallback structures
 */
router.post('/callback', async (req, res) => {
  try {
    // Add detailed logging to diagnose what M-Pesa is sending
    console.log('📥 Raw M-Pesa callback received:', {
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      bodyKeys: Object.keys(req.body),
      bodyType: typeof req.body,
      bodyIsString: typeof req.body === 'string',
      bodyEmpty: Object.keys(req.body).length === 0
    });

    // If body is empty, this is likely M-Pesa testing connectivity - return 200 OK
    if (Object.keys(req.body).length === 0) {
      console.log('⚠️ Empty callback body - likely M-Pesa connectivity test');
      logger.info('M-Pesa connectivity test received (empty callback)');
      return res.status(200).json({ status: 'ok', message: 'Endpoint is reachable' });
    }

    let stkCallback;
    
    // Check for nested Body.stkCallback structure (standard M-Pesa format)
    if (req.body.Body && req.body.Body.stkCallback) {
      stkCallback = req.body.Body.stkCallback;
      console.log('✅ Found stkCallback in nested format (Body.stkCallback)');
    }
    // Check for root-level stkCallback structure
    else if (req.body.stkCallback) {
      stkCallback = req.body.stkCallback;
      console.log('✅ Found stkCallback at root level');
    }
    // Check if entire body IS the stkCallback (in case M-Pesa sends it wrapped differently)
    else if (req.body.CheckoutRequestID) {
      stkCallback = req.body;
      console.log('✅ Entire body is stkCallback (no wrapper)');
    }
    else {
      logger.warn('Invalid M-Pesa callback structure - no stkCallback found', { 
        body: req.body,
        bodyKeys: Object.keys(req.body)
      });
      return res.status(200).json({ success: false, message: 'Invalid callback' });
    }

    logger.info('M-Pesa Callback received', {
      checkoutId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc
    });

    // Check if payment was successful (ResultCode 0 = success)
    if (stkCallback.ResultCode !== 0) {
      logger.warn(`Payment failed with code: ${stkCallback.ResultCode}`, {
        resultDesc: stkCallback.ResultDesc,
        checkoutId: stkCallback.CheckoutRequestID
      });
      return res.status(200).json({ success: false });
    }

    // Extract payment metadata
    const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
    const paymentData = {};

    callbackMetadata.forEach(item => {
      if (item.Name === 'Amount') {paymentData.amount = item.Value;}
      if (item.Name === 'MpesaReceiptNumber') {paymentData.mpesaReceiptNumber = item.Value;}
      if (item.Name === 'TransactionDate') {paymentData.transactionDate = item.Value;}
      if (item.Name === 'PhoneNumber') {paymentData.phoneNumber = formatPhoneNumber(item.Value);}
    });

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;

    // Find token by checkoutRequestId and update it
    const token = await Token.findOneAndUpdate(
      { orderTrackingId: checkoutRequestId },
      {
        phoneNumber: paymentData.phoneNumber,
        amount: paymentData.amount,
        mpesaReceiptNumber: paymentData.mpesaReceiptNumber,
        paymentStatus: 'completed',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        paymentGateway: 'mpesa'
      },
      { new: true }
    );

    if (!token) {
      logger.error('Token not found for callback', {
        checkoutRequestId,
        phoneNumber: paymentData.phoneNumber
      });
      return res.status(200).json({ success: false, message: 'Token not found' });
    }

    logger.info('Payment completed successfully', {
      tokenId: token._id,
      checkoutId: checkoutRequestId,
      amount: paymentData.amount,
      phone: paymentData.phoneNumber
    });

    // Return success to M-Pesa
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('M-Pesa callback processing error', {
      error: error.message,
      stack: error.stack
    });
    res.status(200).json({ success: false, message: 'Processing error' });
  }
});

/**
 * POST /mpesa/callback
 * M-Pesa STK Push payment confirmation endpoint
 * Receives POST request from M-Pesa and processes payment confirmation
 */
router.post('/mpesa/callback', async (req, res) => {
  try {
    // 1. Receive POST request from M-Pesa (already done by Express)
    
    // 2. Parse the JSON body of the request (Express does this automatically)
    const { Body } = req.body;
    
    if (!Body || !Body.stkCallback) {
      logger.warn('Invalid M-Pesa callback structure', { body: req.body });
      return res.status(200).json({ success: false, message: 'Invalid callback' });
    }

    const stkCallback = Body.stkCallback;
    
    // 3. Check if the payment was successful (ResultCode = 0)
    if (stkCallback.ResultCode === 0) {
      // 4. If successful:
      // Extract payment details
      const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
      let amount, phoneNumber, receiptNumber;
      
      callbackMetadata.forEach(item => {
        if (item.Name === 'Amount') amount = item.Value;
        if (item.Name === 'MpesaReceiptNumber') receiptNumber = item.Value;
        if (item.Name === 'PhoneNumber') phoneNumber = formatPhoneNumber(item.Value);
      });
      
      // Log the payment details to database
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      
      const token = await Token.findOneAndUpdate(
        { orderTrackingId: checkoutRequestId },
        {
          phoneNumber,
          amount,
          mpesaReceiptNumber: receiptNumber,
          paymentStatus: 'completed',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Unlock for 24 hours
          paymentGateway: 'mpesa'
        },
        { new: true }
      );
      
      if (token) {
        logger.info('Payment successful - landlord contact unlocked', {
          amount,
          phoneNumber,
          receiptNumber,
          tokenId: token._id
        });
      } else {
        logger.error('Token not found for successful payment', { checkoutRequestId, phoneNumber });
      }
    } else {
      // 5. If failed: Log the failure reason
      logger.warn('Payment failed', {
        resultCode: stkCallback.ResultCode,
        resultDesc: stkCallback.ResultDesc,
        checkoutId: stkCallback.CheckoutRequestID
      });
    }
    
    // 6. Return a 200 OK response to M-Pesa to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('M-Pesa callback processing error', {
      error: error.message,
      stack: error.stack
    });
    // Still return 200 to acknowledge receipt even on error
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
 */
router.post('/mpesa-confirmation', async (req, res) => {
  try {
    logger.info('M-Pesa confirmation received', { body: req.body });

    // TODO: store payment confirmation data if you want to reconcile
    // C2B payments on your system later.
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error('M-Pesa confirmation processing error', { error: error.message, stack: error.stack });
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

/**
 * POST /api/payment/poll-status
 * Poll payment status by checking M-Pesa directly
 * Useful for frontend to check if user completed payment
 * Body: { checkoutRequestId: string }
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
