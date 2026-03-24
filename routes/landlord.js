const express = require('express');
const { body, validationResult, query } = require('express-validator');
const jwt = require('jsonwebtoken');
const Landlord = require('../models/Landlord');
const House = require('../models/House');
const Booking = require('../models/Booking');
const { sendVerificationEmail, sendLandlordDetailsEmail, sendAccountVerifiedEmail } = require('../config/email');
const { sendLandlordRegistrationConfirmation, sendNewBookingNotification } = require('../config/sms');
const path = require('path');
const fs = require('fs');
const { upload, optimizeImage, generateVideoThumbnail, imagesDir, videosDir, thumbnailsDir } = require('../config/multer');
const logger = require('../config/logger');
const { authenticateLandlord } = require('../config/auth');

const router = express.Router();

// ========== AUTHENTICATION ROUTES ==========

/**
 * POST /api/landlord/register - Register new landlord
 */
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('idNumber').trim().notEmpty().withMessage('ID number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, phone, idNumber, bankName, bankAccount } = req.body;

    // Check if landlord with THIS EMAIL exists AND is verified
    let landlord = await Landlord.findOne({ email, emailVerified: true });
    if (landlord) {
      return res.status(400).json({ success: false, message: 'A verified account with this email already exists' });
    }

    // If unverified account exists with this email, delete it to allow re-registration
    const unverifiedLandlord = await Landlord.findOne({ email, emailVerified: false });
    if (unverifiedLandlord) {
      await Landlord.deleteOne({ _id: unverifiedLandlord._id });
      logger.info(`Deleted unverified account for email ${email} to allow re-registration`);
    }

    // Check ID number uniqueness (only verified accounts)
    const existingId = await Landlord.findOne({ idNumber, emailVerified: true });
    if (existingId) {
      return res.status(400).json({ success: false, message: 'This ID number is already registered' });
    }

    // Create new landlord
    landlord = new Landlord({
      name,
      email,
      password,
      phone,
      idNumber,
      bankName,
      bankAccount,
      emailVerificationToken: jwt.sign({ email }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' }),
      emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      emailVerified: false
    });

    await landlord.save();
    logger.info(`New landlord registered: ${email}`);

    // Send verification email
    await sendVerificationEmail(email, landlord.emailVerificationToken);

    // Send SMS confirmation (non-critical)
    sendLandlordRegistrationConfirmation(phone, {
      name,
      email,
      loginUrl: `${process.env.FRONTEND_URL}/landlord-login`
    }).catch(err => logger.warn('SMS registration confirmation failed:', err.message));

    const token = jwt.sign(
      { id: landlord._id, email: landlord.email, role: 'landlord' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Landlord registered successfully. Check your email to verify.',
      landlord: landlord.toJSON(),
      token,
      landlordId: landlord._id
    });
  } catch (error) {
    logger.error('Landlord registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
});


/**
 * POST /api/landlord/properties/:id/media - Upload images/videos for a property
 * Accepts multipart/form-data with fields: images (multiple), videos (multiple)
 */
router.post('/properties/:id/media', authenticateLandlord, upload.fields([{ name: 'images' }, { name: 'videos' }]), async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {return res.status(404).json({ success: false, message: 'Property not found' });}
    if (house.landlord.toString() !== req.landlord.id) {return res.status(403).json({ success: false, message: 'Access denied' });}

    const savedImages = [];
    const savedVideos = [];

    // Process images
    const imageFiles = (req.files && req.files.images) || [];
    for (const file of imageFiles) {
      try {
        const optimized = await optimizeImage(file.path, { format: 'webp', quality: 80 });
        // Store relative path for serving (assumes static serving of /uploads)
        savedImages.push(`/uploads/images/${path.basename(optimized)}`);
      } catch (err) {
        // If optimization fails, fall back to original
        savedImages.push(`/uploads/images/${path.basename(file.path)}`);
      }
    }

    // Process videos
    const videoFiles = (req.files && req.files.videos) || [];
    for (const file of videoFiles) {
      try {
        // Save video path
        savedVideos.push(`/uploads/videos/${path.basename(file.path)}`);
        // Generate thumbnail (best-effort)
        generateVideoThumbnail(file.path).catch(err => logger.warn('Thumbnail generation failed:', err.message));
      } catch (err) {
        savedVideos.push(`/uploads/videos/${path.basename(file.path)}`);
      }
    }

    // Merge with existing media
    house.images = Array.isArray(house.images) ? [...new Set([...(house.images || []), ...savedImages])] : savedImages;
    house.videos = Array.isArray(house.videos) ? [...new Set([...(house.videos || []), ...savedVideos])] : savedVideos;

    await house.save();

    res.json({ success: true, message: 'Media uploaded successfully', images: house.images, videos: house.videos });
  } catch (error) {
    logger.error('Media upload error:', error);
    res.status(500).json({ success: false, message: 'Error uploading media', error: error.message });
  }
});

/**
 * POST /api/landlord/login - Landlord login
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const landlord = await Landlord.findOne({ email });
    if (!landlord) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await landlord.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!landlord.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    // Update last login
    landlord.lastLogin = new Date();
    await landlord.save();

    const token = jwt.sign(
      { id: landlord._id, email: landlord.email, role: 'landlord' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    logger.info(`Landlord login: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      landlord: landlord.toJSON()
    });
  } catch (error) {
    logger.error('Landlord login error:', error);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

/**
 * POST /api/landlord/verify-email - Verify landlord email
 */
router.post('/verify-email', [
  body('token').notEmpty().withMessage('Verification token is required')
], async (req, res) => {
  try {
    const { token } = req.body;

    const landlord = await Landlord.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() }
    });

    if (!landlord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }

    landlord.emailVerified = true;
    landlord.emailVerificationToken = undefined;
    landlord.emailVerificationExpiry = undefined;
    await landlord.save();

    logger.info(`Landlord email verified: ${landlord.email}`);

    // Send account verified email
    await sendAccountVerifiedEmail(landlord.email);

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ success: false, message: 'Verification failed', error: error.message });
  }
});

/**
 * POST /api/landlord/forgot-password - Request password reset
 */
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const { email } = req.body;

    const landlord = await Landlord.findOne({ email });
    if (!landlord) {
      return res.status(404).json({ success: false, message: 'Landlord not found' });
    }

    const resetToken = jwt.sign({ id: landlord._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    
    landlord.passwordResetToken = resetToken;
    landlord.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await landlord.save();

    logger.info(`Password reset requested for: ${email}`);

    res.json({
      success: true,
      message: 'Password reset link sent to your email',
      resetToken
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Error processing request', error: error.message });
  }
});

// ========== PROFILE MANAGEMENT ==========

/**
 * GET /api/landlord/profile - Get landlord profile
 */
router.get('/profile', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord.id)
      .populate('properties', 'title location price bedrooms amenities rating')
      .lean();

    if (!landlord) {
      return res.status(404).json({ success: false, message: 'Landlord not found' });
    }

    res.json({
      success: true,
      landlord
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving profile', error: error.message });
  }
});

/**
 * PATCH /api/landlord/profile - Update landlord profile
 */
router.patch('/profile', authenticateLandlord, [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty(),
  body('bankName').optional().trim(),
  body('bankAccount').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, phone, bankName, bankAccount, profilePicture } = req.body;

    const landlord = await Landlord.findByIdAndUpdate(
      req.landlord.id,
      { $set: { name, phone, bankName, bankAccount, profilePicture } },
      { new: true }
    );

    logger.info(`Landlord profile updated: ${landlord.email}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      landlord: landlord.toJSON()
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile', error: error.message });
  }
});

// ========== PROPERTY MANAGEMENT ==========

/**
 * GET /api/landlord/properties - Get landlord's properties
 */
router.get('/properties', authenticateLandlord, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await House.countDocuments({ landlord: req.landlord.id });
    const properties = await House.find({ landlord: req.landlord.id })
      .skip(skip)
      .limit(limit)
      .populate('landlord', 'name phone email');

    res.json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      properties
    });
  } catch (error) {
    logger.error('Get properties error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving properties', error: error.message });
  }
});

/**
 * POST /api/landlord/properties - Create new property
 */
router.post('/properties', authenticateLandlord, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('bedrooms').isInt({ min: 1 }).withMessage('Number of bedrooms is required'),
  body('description').optional().trim(),
  body('amenities').optional().isArray(),
  body('type').optional().isIn(['apartment', 'house', 'hostel', 'room'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, location, price, bedrooms, description, amenities, type, furnished, images, videos } = req.body;

    const house = new House({
      title,
      location,
      price,
      bedrooms,
      description,
      amenities: amenities || [],
      type: type || 'apartment',
      furnished: furnished || false,
      landlord: req.landlord.id,
      images: images || [],
      videos: videos || []
    });

    await house.save();
    logger.info(`New property created by landlord: ${req.landlord.email}`);

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      property: house
    });
  } catch (error) {
    logger.error('Create property error:', error);
    res.status(500).json({ success: false, message: 'Error creating property', error: error.message });
  }
});

/**
 * PATCH /api/landlord/properties/:id - Update property
 */
router.patch('/properties/:id', authenticateLandlord, [
  body('title').optional().trim().notEmpty(),
  body('location').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('bedrooms').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (house.landlord.toString() !== req.landlord.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { title, location, price, bedrooms, description, amenities, furnished } = req.body;
    
    Object.assign(house, { title, location, price, bedrooms, description, amenities, furnished });
    await house.save();

    logger.info(`Property updated: ${house._id}`);

    res.json({
      success: true,
      message: 'Property updated successfully',
      property: house
    });
  } catch (error) {
    logger.error('Update property error:', error);
    res.status(500).json({ success: false, message: 'Error updating property', error: error.message });
  }
});

/**
 * DELETE /api/landlord/properties/:id - Delete property
 */
router.delete('/properties/:id', authenticateLandlord, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (house.landlord.toString() !== req.landlord.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await House.findByIdAndDelete(req.params.id);
    logger.info(`Property deleted: ${house._id}`);

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    logger.error('Delete property error:', error);
    res.status(500).json({ success: false, message: 'Error deleting property', error: error.message });
  }
});

// ========== DASHBOARD & ANALYTICS ==========

/**
 * GET /api/landlord/dashboard - Get landlord dashboard stats
 */
router.get('/dashboard', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord.id);
    const properties = await House.find({ landlord: req.landlord.id });
    const bookings = await Booking.find({ 'houseId': { $in: properties.map(p => p._id) } });

    const stats = {
      totalProperties: properties.length,
      totalBookings: bookings.length,
      activeBookings: bookings.filter(b => b.status === 'confirmed').length,
      pendingBookings: bookings.filter(b => b.status === 'pending').length,
      totalViews: properties.reduce((sum, p) => sum + (p.views || 0), 0),
      totalRating: properties.length > 0 
        ? (properties.reduce((sum, p) => sum + (p.rating?.average || 0), 0) / properties.length).toFixed(2)
        : 0
    };

    res.json({
      success: true,
      stats,
      landlord: landlord.toJSON()
    });
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Error fetching dashboard', error: error.message });
  }
});

/**
 * GET /api/landlord/earnings - Get earnings summary
 */
router.get('/earnings', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord.id);
    const properties = await House.find({ landlord: req.landlord.id });
    const bookings = await Booking.find({ 
      'houseId': { $in: properties.map(p => p._id) },
      status: 'completed'
    });

    const totalEarnings = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);

    res.json({
      success: true,
      earnings: {
        totalEarnings,
        completedBookings: bookings.length,
        pendingBookings: await Booking.countDocuments({ 
          'houseId': { $in: properties.map(p => p._id) },
          status: 'pending'
        })
      }
    });
  } catch (error) {
    logger.error('Earnings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching earnings', error: error.message });
  }
});

module.exports = router;
