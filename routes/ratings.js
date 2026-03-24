const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const UserRating = require('../models/UserRating');
const Booking = require('../models/Booking');
const Student = require('../models/Student');
const Landlord = require('../models/Landlord');
const { authenticateStudent, authenticateLandlord } = require('../config/auth');
const { body, validationResult } = require('express-validator');

// Rate landlord (student rates landlord)
router.post('/landlord', authenticateStudent, body('landlordId').notEmpty(), body('rating').isInt({ min: 1, max: 5 }), body('bookingId').notEmpty(), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {return res.status(400).json({ success: false, errors: errors.array() });}

  const booking = await Booking.findById(req.body.bookingId);
  if (!booking || booking.studentId.toString() !== req.user.id) {return res.status(400).json({ success: false, message: 'Invalid booking' });}

  const existing = await UserRating.findOne({ ratedBy: req.user.id, ratedUser: req.body.landlordId, bookingId: req.body.bookingId });
  if (existing) {return res.status(400).json({ success: false, message: 'Already rated this landlord' });}

  const rating = new UserRating({
    ratedBy: req.user.id,
    ratedByType: 'Student',
    ratedUser: req.body.landlordId,
    ratedUserType: 'Landlord',
    bookingId: req.body.bookingId,
    rating: req.body.rating,
    categories: req.body.categories || {},
    comment: req.body.comment,
    verified: true,
    anonymous: req.body.anonymous || false,
  });

  await rating.save();
  const trustScore = await UserRating.calculateTrustScore(req.body.landlordId, 'Landlord');
  res.status(201).json({ success: true, message: 'Landlord rated successfully', data: rating, landlordTrustScore: trustScore });
}));

// Rate student (landlord rates student)
router.post('/student', authenticateLandlord, body('studentId').notEmpty(), body('rating').isInt({ min: 1, max: 5 }), body('bookingId').notEmpty(), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {return res.status(400).json({ success: false, errors: errors.array() });}

  const booking = await Booking.findById(req.body.bookingId);
  if (!booking || booking.landlordId.toString() !== req.user.id) {return res.status(400).json({ success: false, message: 'Invalid booking' });}

  const existing = await UserRating.findOne({ ratedBy: req.user.id, ratedUser: req.body.studentId, bookingId: req.body.bookingId });
  if (existing) {return res.status(400).json({ success: false, message: 'Already rated this student' });}

  const rating = new UserRating({
    ratedBy: req.user.id,
    ratedByType: 'Landlord',
    ratedUser: req.body.studentId,
    ratedUserType: 'Student',
    bookingId: req.body.bookingId,
    rating: req.body.rating,
    categories: req.body.categories || {},
    comment: req.body.comment,
    verified: true,
    anonymous: req.body.anonymous || false,
  });

  await rating.save();
  const trustScore = await UserRating.calculateTrustScore(req.body.studentId, 'Student');
  res.status(201).json({ success: true, message: 'Student rated successfully', data: rating, studentTrustScore: trustScore });
}));

// Get trust score for landlord
router.get('/trust-score/landlord/:landlordId', asyncHandler(async (req, res) => {
  const trustScore = await UserRating.calculateTrustScore(req.params.landlordId, 'Landlord');
  res.json({ success: true, data: trustScore });
}));

// Get trust score for student
router.get('/trust-score/student/:studentId', asyncHandler(async (req, res) => {
  const trustScore = await UserRating.calculateTrustScore(req.params.studentId, 'Student');
  res.json({ success: true, data: trustScore });
}));

// Get ratings for landlord
router.get('/landlord/:landlordId', asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const ratings = await UserRating.find({ ratedUser: req.params.landlordId, ratedUserType: 'Landlord', verified: true })
    .populate('ratedBy', 'firstName lastName -_id')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await UserRating.countDocuments({ ratedUser: req.params.landlordId, ratedUserType: 'Landlord', verified: true });

  res.json({ success: true, data: ratings, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
}));

// Get ratings for student
router.get('/student/:studentId', asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const ratings = await UserRating.find({ ratedUser: req.params.studentId, ratedUserType: 'Student', verified: true })
    .populate('ratedBy', 'name -_id')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await UserRating.countDocuments({ ratedUser: req.params.studentId, ratedUserType: 'Student', verified: true });

  res.json({ success: true, data: ratings, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
}));

module.exports = router;