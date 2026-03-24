const express = require('express');
const { verifyToken } = require('../config/auth');
const Token = require('../models/Token');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/access/status
 * Check if user has paid for access (for listing page)
 * ⚠️ IMPORTANT: This checks PAYMENT ACCESS ONLY, NOT BOOKING STATUS
 * Bookings do NOT affect listing access - they're independent
 * Access ONLY expires if:
 * - 24 hours have passed since payment
 * - Admin revokes access (not implemented yet)
 * Making a booking does NOT expire access
 */
router.get('/status', async (req, res) => {
  try {
    const token = req.cookies?.authToken;

    // No token = no access
    if (!token) {
      return res.json({
        hasAccess: false,
        isPaid: false,
        expiresAt: null,
        message: 'No access token - please purchase access'
      });
    }

    const decoded = verifyToken(token);
    
    // Invalid token or expired
    if (!decoded) {
      return res.json({
        hasAccess: false,
        isPaid: false,
        expiresAt: null,
        message: 'Access token expired - please purchase access'
      });
    }

    // User has valid access token (from payment)
    // Bookings do NOT affect this - access continues for full 24h
    if (decoded.role === 'user') {
      const expiresAt = decoded.exp * 1000; // Convert to milliseconds
      const timeRemaining = expiresAt - Date.now();
      
      if (timeRemaining <= 0) {
        return res.json({
          hasAccess: false,
          isPaid: false,
          expiresAt: null,
          message: 'Access token expired - please purchase access'
        });
      }
      
      return res.json({
        hasAccess: true,
        isPaid: true,
        email: decoded.email,
        expiresAt: expiresAt,
        timeRemaining: timeRemaining,
        message: 'Access granted - bookings do not affect listing access'
      });
    }

    // Landlord/Admin automatically have access
    if (decoded.role === 'landlord' || decoded.role === 'admin') {
      return res.json({
        hasAccess: true,
        isPaid: false,
        role: decoded.role,
        message: 'Full access granted'
      });
    }

    res.json({
      hasAccess: false,
      isPaid: false,
      expiresAt: null,
      message: 'Invalid token'
    });

  } catch (err) {
    logger.error(`Error checking access status: ${err.message}`);
    res.status(500).json({
      hasAccess: false,
      message: 'Error checking access status'
    });
  }
});

/**
 * POST /api/access/grant-payment-access
 * Grant user 24-hour access after successful payment
 * Called after M-Pesa payment callback
 */
router.post('/grant-payment-access', async (req, res) => {
  try {
    const { userEmail, paymentReference, amount } = req.body;

    if (!userEmail || !paymentReference) {
      return res.status(400).json({ 
        message: 'userEmail and paymentReference are required' 
      });
    }

    // Create a token for user access (24 hours)
    const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const accessToken = new Token({
      token: `user_${Math.random().toString(36).substr(2, 9)}`,
      userEmail,
      expiresAt: expiryTime,
      paymentReference,
      amount: amount || 100,
      isUsed: false
    });

    await accessToken.save();

    // Generate JWT token for 24 hours
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../config/auth');
    const jwtToken = jwt.sign(
      { email: userEmail, role: 'user' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('authToken', jwtToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });

    logger.info(`Payment access granted to: ${userEmail}`);

    res.status(200).json({
      message: 'Payment access granted successfully',
      accessToken: accessToken._id,
      expiresAt: expiryTime,
      email: userEmail
    });

  } catch (err) {
    logger.error(`Error granting payment access: ${err.message}`);
    res.status(500).json({
      message: 'Error granting payment access',
      error: err.message
    });
  }
});

module.exports = router;
