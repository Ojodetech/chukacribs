const express = require('express');
const { body, validationResult, param } = require('express-validator');
const jwt = require('jsonwebtoken');
const SiteReview = require('../models/SiteReview');
const logger = require('../config/logger');

const router = express.Router();

const authenticateAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Access denied - admin only' });
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Submit feedback (public)
router.post('/', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('message').trim().isLength({ min: 5, max: 2000 }).withMessage('Message length 5-2000')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { name, email, message, rating } = req.body;
    const review = new SiteReview({ name, email, message, rating });
    await review.save();
    logger.info('Site feedback submitted', { id: review._id });
    res.status(201).json({ success: true, message: 'Feedback submitted. It will appear after admin approval.' });
  } catch (err) {
    logger.error('Feedback submit error', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Public: get approved feedback
router.get('/approved', async (req, res) => {
  try {
    const reviews = await SiteReview.find({ status: 'approved' }).sort({ approvedAt: -1 }).limit(20).lean();
    res.json({ success: true, reviews });
  } catch (err) {
    logger.error('Get approved feedback error', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin: list pending feedback
router.get('/pending', authenticateAdmin, async (req, res) => {
  try {
    const pending = await SiteReview.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, reviews: pending });
  } catch (err) {
    logger.error('Get pending feedback error', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin: approve
router.patch('/:id/approve', authenticateAdmin, [param('id').isMongoId()], async (req, res) => {
  try {
    const review = await SiteReview.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Feedback not found' });
    review.status = 'approved';
    review.approvedAt = new Date();
    await review.save();
    res.json({ success: true, message: 'Feedback approved', review });
  } catch (err) {
    logger.error('Approve feedback error', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin: reject
router.patch('/:id/reject', authenticateAdmin, [param('id').isMongoId()], async (req, res) => {
  try {
    const review = await SiteReview.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Feedback not found' });
    review.status = 'rejected';
    await review.save();
    res.json({ success: true, message: 'Feedback rejected', review });
  } catch (err) {
    logger.error('Reject feedback error', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
