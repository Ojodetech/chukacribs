const express = require('express');
const { body, validationResult } = require('express-validator');
const Landlord = require('../models/Landlord');
const {
  generateToken,
  generateAdminToken,
  authenticateLandlord,
  authenticateAdmin,
  setAuthCookie,
  setAdminCookie,
  clearAuthCookies,
  verifyToken
} = require('../config/auth');
const { validatePasswordStrength } = require('../config/security');
const logger = require('../config/logger');
const { 
  sendVerificationEmail, 
  sendLandlordDetailsEmail, 
  sendAccountVerifiedEmail 
} = require('../config/email');
const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  DatabaseError,
  ServiceUnavailableError
} = require('../config/errors');

const router = express.Router();

// Register landlord
router.post(
  '/register',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('phone')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Phone number must be valid'),
    body('idNumber')
      .trim()
      .isLength({ min: 1, max: 20 })
      .withMessage('Invalid ID number format')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.fromValidationResult(errors);
      }

      const { name, email, password, phone, idNumber } = req.body;

      // Password strength validation
      const pwdStrength = validatePasswordStrength(password);
      if (!pwdStrength.valid) {
        throw new ValidationError('Weak password', pwdStrength.errors.map((msg) => ({ message: msg })));
      }

      // Check if landlord with THIS EMAIL exists
      let landlord = await Landlord.findOne({ email });
      if (landlord) {
        throw ConflictError.emailExists();
      }

      // Check ID number uniqueness
      const existingId = await Landlord.findOne({ idNumber });
      if (existingId) {
        throw ConflictError.duplicateEntry('ID number already registered');
      }

      // Create new landlord (email NOT verified initially)
      landlord = new Landlord({ name, email, password, phone, idNumber });
      
      // Generate email verification token (valid for 24 hours)
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      landlord.emailVerificationToken = verificationToken;
      landlord.emailVerificationExpiry = verificationExpiry;
      landlord.emailVerified = false;
      
      await landlord.save();

      // Send verification email with token link (best effort - don't fail registration if email fails)
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      let emailSent = false;
      
      try {
        const { sendVerificationEmailWithLink } = require('../config/email');
        const verificationEmail = await sendVerificationEmailWithLink(email, {
          name,
          verificationLink
        });

        if (verificationEmail.success || verificationEmail.result) {
          logger.info(`Email verification link sent to new landlord: ${email}`);
          emailSent = true;
        } else {
          logger.warn(`Failed to send verification email to ${email}:`, verificationEmail.error);
        }
      } catch (emailErr) {
        logger.warn(`Email sending error during registration (non-blocking): ${emailErr.message}`);
        // Don't fail registration if email fails in development
        if (process.env.NODE_ENV === 'production') {
          throw ServiceUnavailableError.emailServiceDown(emailErr.message);
        }
      }

      logger.info(`New landlord registered: ${email}`);

      // Return user info with redirect info (NO auto-login)
      res.status(201).json({
        success: true,
        message: emailSent 
          ? 'Landlord registered successfully. Please check your email to verify your account.'
          : 'Landlord registered successfully. (Email verification skipped - development mode)',
        landlord: {
          id: landlord._id,
          name: landlord.name,
          email: landlord.email,
          phone: landlord.phone
        },
        requiresVerification: true,
        redirectTo: '/verify-email-pending'
      });
    } catch (err) {
      logger.error(`Registration error: ${err.message}`);

      if (err && err.isOperational && typeof err.toJSON === 'function') {
        return res.status(err.statusCode || 400).json(err.toJSON());
      }

      res.status(500).json({ success: false, message: 'Error registering landlord', error: err.message });
    }
  }
);

// Login landlord
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.fromValidationResult(errors);
      }

      const { email, password } = req.body;

      const landlord = await Landlord.findOne({ email });
      if (!landlord) {
        throw AuthenticationError.invalidCredentials();
      }

      // Check password
      const isMatch = await landlord.comparePassword(password);
      if (!isMatch) {
        throw AuthenticationError.invalidCredentials();
      }

      // Check if email is verified (allow login in test environment)
      if (!landlord.emailVerified && process.env.NODE_ENV !== 'test') {
        throw AuthenticationError.emailNotVerified();
      }

      // Check if account is active (allow login in test environment)
      if (landlord.status !== 'active' && process.env.NODE_ENV !== 'test') {
        throw AuthorizationError.actionNotAllowed(`Account is ${landlord.status}`);
      }

      // Generate token and set HTTP-only cookie
      const token = generateToken(landlord._id, 'landlord');
      setAuthCookie(res, token);

      logger.info(`Landlord logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        token,
        landlord: {
          id: landlord._id,
          name: landlord.name,
          email: landlord.email,
          phone: landlord.phone
        }
      });
    } catch (err) {
      logger.error(`Login error: ${err.message}`);
      // If this is an operational AppError (custom error), return its status and payload
      if (err && err.isOperational && typeof err.toJSON === 'function') {
        return res.status(err.statusCode || 400).json(err.toJSON());
      }

      res.status(500).json({ message: 'Error logging in', error: err.message });
    }
  }
);

// Get current user/landlord info from auth cookie
router.get('/me', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlordId)
      .populate('properties')
      .select('-password');

    if (!landlord) {
      clearAuthCookies(res);
      throw NotFoundError.userNotFound();
    }

    res.json({
      id: landlord._id,
      name: landlord.name,
      email: landlord.email,
      phone: landlord.phone,
      role: 'landlord',
      verified: landlord.verified,
      properties: landlord.properties
    });
  } catch (err) {
    logger.error(`Error fetching user info: ${err.message}`);
    res.status(500).json({ message: 'Error fetching user info', error: err.message });
  }
});

// Check admin authentication status from secure cookie
router.get('/me/admin', (req, res) => {
  const adminToken = req.cookies?.adminToken;
  
  if (!adminToken) {
    return res.status(401).json({ message: 'Unauthorized - No admin token' });
  }

  const decoded = verifyToken(adminToken);
  
  if (!decoded || decoded.role !== 'admin') {
    return res.status(401).json({ message: 'Unauthorized - Invalid admin token' });
  }

  res.json({
    role: 'admin',
    authenticated: true,
    expiresAt: new Date(decoded.exp * 1000)
  });
});

// Get current landlord profile
router.get('/profile', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlordId)
      .populate('properties')
      .select('-password');

    if (!landlord) {
      throw NotFoundError.userNotFound();
    }

    res.json(landlord.toJSON());
  } catch (err) {
    throw err;
  }
});

// Update landlord profile
router.patch(
  '/profile',
  authenticateLandlord,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('phone')
      .optional()
      .trim()
      .matches(/^(\+?254|0)[1-9]\d{8}$/)
      .withMessage('Invalid Kenyan phone number'),
    body('bankName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Bank name too long'),
    body('bankAccount')
      .optional()
      .trim()
      .matches(/^[A-Z0-9]{5,}$/)
      .withMessage('Invalid bank account format')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.fromValidationResult(errors);
      }

      const { name, phone, bankName, bankAccount } = req.body;

      const landlord = await Landlord.findByIdAndUpdate(
        req.landlordId,
        { name, phone, bankName, bankAccount },
        { new: true }
      ).select('-password');

      res.json({
        message: 'Profile updated successfully',
        ...landlord.toJSON()
      });
    } catch (err) {
      throw err;
    }
  }
);

// Logout
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  // Also clear admin token cookie
  res.clearCookie('adminToken', { path: '/' });
  logger.info('User logged out');
  res.json({ message: 'Logged out successfully' });
});

// Get all landlords (admin only)
router.get('/', async (req, res) => {
  try {
    const landlords = await Landlord.find()
      .populate('properties')
      .select('-password');

    res.json(landlords);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching landlords', error: err.message });
  }
});

// Get landlord by ID
router.get('/:id', async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.params.id)
      .populate('properties');

    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    res.json(landlord.toJSON());
  } catch (err) {
    res.status(500).json({ message: 'Error fetching landlord', error: err.message });
  }
});

// Admin login endpoint
router.post('/admin/login', async (req, res) => {
  try {
    const { secretKey } = req.body;

    if (!secretKey) {
      return res.status(400).json({ message: 'Secret key is required' });
    }

    // Verify the secret key (trim whitespace)
    const trimmedKey = secretKey.trim();
    const envKey = (process.env.ADMIN_SECRET_KEY || '').trim();
    
    console.log('Admin login attempt:');
    console.log('  Received key length:', trimmedKey.length);
    console.log('  Expected key length:', envKey.length);
    console.log('  Keys match:', trimmedKey === envKey);

    if (trimmedKey !== envKey) {
      logger.warn('Failed admin login attempt with invalid key');
      return res.status(401).json({ success: false, message: 'Invalid secret key' });
    }

    // Generate admin JWT and set secure HTTP-only cookie
    const adminToken = generateAdminToken('4h');
    setAdminCookie(res, adminToken, 4 * 60 * 60 * 1000);

    logger.info('Admin successfully authenticated');
    res.json({
      success: true,
      message: 'Admin authenticated successfully',
      expiresIn: '4 hours'
    });
  } catch (err) {
    logger.error('Admin login error:', err);
    res.status(500).json({ message: 'Error processing admin login', error: err.message });
  }
});

// Send email verification code
router.post('/verify-email/send', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlordId);
    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save code and expiry time
    landlord.emailVerificationToken = verificationCode;
    landlord.emailVerificationExpiry = expiryTime;
    await landlord.save();

    // Send verification email via Gmail SMTP
    const emailResult = await sendVerificationEmail(landlord.email, verificationCode);

    if (!emailResult.success) {
      logger.error(`Failed to send verification email to ${landlord.email}`);
      return res.status(500).json({ 
        message: 'Failed to send verification code. Please try again.',
        error: emailResult.error 
      });
    }
    
    logger.info(`Email verification code sent to ${landlord.email}`);
    res.json({
      message: 'Verification code sent to your email',
      email: landlord.email,
      expiresIn: 15 * 60 // 15 minutes in seconds
    });
  } catch (err) {
    logger.error('Email verification send error:', err);
    res.status(500).json({ message: 'Error sending verification code', error: err.message });
  }
});

// Verify email with token (from email link - no authentication required)
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const landlord = await Landlord.findOne({ emailVerificationToken: token });
    if (!landlord) {
      return res.status(400).json({ message: 'Invalid or expired verification link' });
    }

    // Check if token has expired
    if (!landlord.emailVerificationExpiry || new Date() > landlord.emailVerificationExpiry) {
      return res.status(400).json({ message: 'Verification link has expired. Please register again.' });
    }

    // Mark email as verified
    landlord.emailVerified = true;
    landlord.emailVerificationToken = undefined;
    landlord.emailVerificationExpiry = undefined;
    await landlord.save();

    // Send account verified confirmation email
    const verifiedEmail = await sendAccountVerifiedEmail(landlord.email);
    if (verifiedEmail.success) {
      logger.info(`Account verified confirmation sent to ${landlord.email}`);
    }

    logger.info(`Email verified for landlord: ${landlord.email}`);
    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
      redirectTo: '/landlord-login'
    });
  } catch (err) {
    logger.error('Email verification error:', err);
    res.status(500).json({ message: 'Error verifying email', error: err.message });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const landlord = await Landlord.findOne({ email });
    if (!landlord) {
      return res.status(404).json({ message: 'Account not found with this email' });
    }

    // Check if already verified
    if (landlord.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified. You can log in now.' });
    }

    // Generate new verification token
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    landlord.emailVerificationToken = verificationToken;
    landlord.emailVerificationExpiry = verificationExpiry;
    await landlord.save();

    // Send verification email with token link
    const { sendVerificationEmailWithLink } = require('../config/email');
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const verificationEmail = await sendVerificationEmailWithLink(email, {
      name: landlord.name,
      verificationLink
    });

    if (verificationEmail.success) {
      logger.info(`Verification email resent to: ${email}`);
      res.json({
        success: true,
        message: 'Verification email has been resent. Please check your inbox.'
      });
    } else {
      logger.warn(`Failed to resend verification email to ${email}`);
      res.status(500).json({ 
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      });
    }
  } catch (err) {
    logger.error('Resend verification error:', err);
    res.status(500).json({ message: 'Error resending verification email', error: err.message });
  }
});

// Verify email with code
router.post('/verify-email/confirm', authenticateLandlord, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    const landlord = await Landlord.findById(req.landlordId);
    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    // Check code and expiry
    if (landlord.emailVerificationToken !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (!landlord.emailVerificationExpiry || new Date() > landlord.emailVerificationExpiry) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    // Mark email as verified
    landlord.emailVerified = true;
    landlord.emailVerificationToken = undefined;
    landlord.emailVerificationExpiry = undefined;
    await landlord.save();

    // Send account verified confirmation email
    const verifiedEmail = await sendAccountVerifiedEmail(landlord.email);
    if (verifiedEmail.success) {
      logger.info(`Account verified confirmation sent to ${landlord.email}`);
    }

    logger.info(`Email verified for landlord: ${landlord.email}`);
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (err) {
    logger.error('Email verification confirm error:', err);
    res.status(500).json({ message: 'Error verifying email', error: err.message });
  }
});

// Send phone verification code (SMS in production)
router.post('/verify-phone/send', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlordId);
    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    // Generate a simple verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    landlord.phoneVerificationCode = verificationCode;
    landlord.phoneVerificationExpiry = expiryTime;
    await landlord.save();

    // In production, send SMS with Twilio or similar
    console.log(`📱 Phone verification code for ${landlord.phone}: ${verificationCode}`);

    logger.info(`Phone verification code sent to ${landlord.phone}`);
    res.json({
      message: 'Verification code sent to your phone',
      phone: landlord.phone,
      expiresIn: 10 * 60 // 10 minutes in seconds
    });
  } catch (err) {
    logger.error('Phone verification send error:', err);
    res.status(500).json({ message: 'Error sending verification code', error: err.message });
  }
});

// Verify phone with code
router.post('/verify-phone/confirm', authenticateLandlord, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    const landlord = await Landlord.findById(req.landlordId);
    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    // Check code and expiry
    if (landlord.phoneVerificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (!landlord.phoneVerificationExpiry || new Date() > landlord.phoneVerificationExpiry) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    // Mark phone as verified
    landlord.phoneVerified = true;
    landlord.phoneVerificationCode = undefined;
    landlord.phoneVerificationExpiry = undefined;
    await landlord.save();

    logger.info(`Phone verified for landlord: ${landlord.phone}`);
    res.json({
      success: true,
      message: 'Phone verified successfully'
    });
  } catch (err) {
    logger.error('Phone verification confirm error:', err);
    res.status(500).json({ message: 'Error verifying phone', error: err.message });
  }
});

// Resend landlord account details email
router.post('/resend-details', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlordId);
    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    // Send landlord details email
    const emailResult = await sendLandlordDetailsEmail(landlord.email, {
      name: landlord.name,
      phone: landlord.phone,
      idNumber: landlord.idNumber,
      landlordId: landlord._id.toString(),
      activationLink: `${process.env.FRONTEND_URL}/landlord-login`
    });

    if (!emailResult.success) {
      logger.error(`Failed to resend details to ${landlord.email}`);
      return res.status(500).json({ 
        message: 'Failed to send email. Please try again.',
        error: emailResult.error 
      });
    }

    logger.info(`Landlord details re-sent to ${landlord.email}`);
    res.json({
      success: true,
      message: 'Account details sent to your email',
      email: landlord.email
    });
  } catch (err) {
    logger.error('Resend details error:', err);
    res.status(500).json({ message: 'Error sending details', error: err.message });
  }
});

module.exports = router;