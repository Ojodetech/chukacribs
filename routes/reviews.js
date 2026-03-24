const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const jwt = require('jsonwebtoken');
const Review = require('../models/Review');
const House = require('../models/House');
const Booking = require('../models/Booking');
const { handleValidationErrors, CustomValidators } = require('../config/validation');
const logger = require('../config/logger');

const router = express.Router();

// ========== MIDDLEWARE ==========

const authenticateStudent = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {return res.status(401).json({ success: false, message: 'No token provided' });}

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Access denied - student only' });
    }

    req.student = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const authenticateLandlord = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {return res.status(401).json({ success: false, message: 'No token provided' });}

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.role !== 'landlord') {
      return res.status(403).json({ success: false, message: 'Access denied - landlord only' });
    }

    req.landlord = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ========== STUDENT REVIEWS ==========

/**
 * POST /api/reviews - Submit a review
 */
router.post('/', authenticateStudent, [
  body('houseId')
    .trim()
    .isMongoId()
    .withMessage('Invalid house ID format')
    .custom(CustomValidators.noNoSQLInjection),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be 5-100 characters')
    .custom(CustomValidators.noXSS)
    .custom(CustomValidators.noNoSQLInjection),
  body('comment')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Comment must be 10-1000 characters')
    .custom(CustomValidators.noXSS)
    .custom(CustomValidators.noNoSQLInjection)
], handleValidationErrors, async (req, res) => {
  try {
    const { houseId, rating, title, comment, categories, photos, tags } = req.body;

    // Verify house exists
    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ success: false, message: 'House not found' });
    }

    // Verify student has booked this house
    const booking = await Booking.findOne({
      'studentId': req.student.id,
      houseId,
      status: 'completed'
    });

    if (!booking) {
      return res.status(403).json({ success: false, message: 'You can only review houses you have booked' });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      houseId,
      studentId: req.student.id
    });

    if (existingReview) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this house' });
    }

    const review = new Review({
      houseId,
      studentId: req.student.id,
      landlordId: house.landlord,
      rating,
      title,
      comment,
      categories: categories || {},
      photos: photos || [],
      tags: tags || [],
      verified: true, // Mark as verified since it's from a confirmed booking
      bookedFor: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        duration: booking.duration
      }
    });

    await review.save();
    logger.info(`Review submitted for house ${houseId} by student ${req.student.id}`);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review
    });
  } catch (error) {
    logger.error('Review submission error:', error);
    res.status(500).json({ success: false, message: 'Error submitting review', error: error.message });
  }
});

/**
 * GET /api/reviews/house/:houseId - Get house reviews
 */
router.get('/house/:houseId', [
  param('houseId').notEmpty().withMessage('House ID is required'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('sort').optional().isIn(['recent', 'helpful', 'highest', 'lowest'])
], async (req, res) => {
  try {
    const { houseId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'recent';
    const skip = (page - 1) * limit;

    let sortOption = { createdAt: -1 };
    if (sort === 'helpful') {sortOption = { 'helpful.count': -1 };}
    if (sort === 'highest') {sortOption = { rating: -1 };}
    if (sort === 'lowest') {sortOption = { rating: 1 };}

    const total = await Review.countDocuments({ houseId, verified: true });
    const reviews = await Review.find({ houseId, verified: true })
      .populate('studentId', 'firstName lastName')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const averageRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      averageRating,
      reviews
    });
  } catch (error) {
    logger.error('Get reviews error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews', error: error.message });
  }
});

/**
 * GET /api/reviews/my-reviews - Get my reviews
 */
router.get('/my-reviews', authenticateStudent, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 20 })
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Review.countDocuments({ studentId: req.student.id });
    const reviews = await Review.find({ studentId: req.student.id })
      .populate('houseId', 'title location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      reviews
    });
  } catch (error) {
    logger.error('Get my reviews error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews', error: error.message });
  }
});

/**
 * PATCH /api/reviews/:id - Update review
 */
router.patch('/:id', authenticateStudent, [
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('title').optional().trim().isLength({ min: 5, max: 100 }),
  body('comment').optional().trim().isLength({ min: 10, max: 1000 })
], async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.studentId.toString() !== req.student.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { rating, title, comment, categories, photos, tags } = req.body;
    Object.assign(review, { rating, title, comment, categories, photos, tags });
    await review.save();

    logger.info(`Review updated: ${review._id}`);

    res.json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    logger.error('Update review error:', error);
    res.status(500).json({ success: false, message: 'Error updating review', error: error.message });
  }
});

/**
 * DELETE /api/reviews/:id - Delete review
 */
router.delete('/:id', authenticateStudent, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.studentId.toString() !== req.student.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Review.findByIdAndDelete(req.params.id);
    logger.info(`Review deleted: ${review._id}`);

    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    logger.error('Delete review error:', error);
    res.status(500).json({ success: false, message: 'Error deleting review', error: error.message });
  }
});

/**
 * POST /api/reviews/:id/helpful - Mark review as helpful
 */
router.post('/:id/helpful', authenticateStudent, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const studentId = req.student.id;
    const upvoteIndex = review.helpful.upvotes.indexOf(studentId);
    const downvoteIndex = review.helpful.downvotes.indexOf(studentId);

    if (upvoteIndex === -1) {
      review.helpful.upvotes.push(studentId);
      if (downvoteIndex > -1) {
        review.helpful.downvotes.splice(downvoteIndex, 1);
      }
    } else {
      review.helpful.upvotes.splice(upvoteIndex, 1);
    }

    review.helpful.count = review.helpful.upvotes.length - review.helpful.downvotes.length;
    await review.save();

    res.json({ success: true, message: 'Thank you for your feedback', review });
  } catch (error) {
    logger.error('Helpful vote error:', error);
    res.status(500).json({ success: false, message: 'Error recording vote', error: error.message });
  }
});

// ========== LANDLORD RESPONSES ==========

/**
 * GET /api/reviews/property-reviews - Get reviews for my properties
 */
router.get('/property-reviews', authenticateLandlord, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 20 })
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Review.countDocuments({ landlordId: req.landlord.id });
    const reviews = await Review.find({ landlordId: req.landlord.id })
      .populate('houseId', 'title')
      .populate('studentId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      reviews
    });
  } catch (error) {
    logger.error('Get property reviews error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews', error: error.message });
  }
});

/**
 * POST /api/reviews/:id/respond - Landlord response to review
 */
router.post('/:id/respond', authenticateLandlord, [
  body('text').trim().notEmpty().isLength({ min: 5, max: 500 }).withMessage('Response required (5-500 chars)')
], async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.landlordId.toString() !== req.landlord.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    review.landlordResponse = {
      text: req.body.text,
      respondedAt: new Date()
    };

    await review.save();
    logger.info(`Landlord responded to review: ${review._id}`);

    res.json({
      success: true,
      message: 'Response posted successfully',
      review
    });
  } catch (error) {
    logger.error('Respond to review error:', error);
    res.status(500).json({ success: false, message: 'Error posting response', error: error.message });
  }
});

module.exports = router;
