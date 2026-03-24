const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const PaymentHistory = require('../models/PaymentHistory');
const Booking = require('../models/Booking');
const { authenticateStudent, authenticateLandlord } = require('../config/auth');
const { body, validationResult } = require('express-validator');

// Get payment history for student
router.get('/student', authenticateStudent, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const query = { studentId: req.user.id };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await PaymentHistory.find(query)
      .populate('bookingId', 'checkInDate checkOutDate')
      .populate('houseId', 'title location')
      .populate('landlordId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PaymentHistory.countDocuments(query);

    const summary = await PaymentHistory.aggregate([
      { $match: { studentId: require('mongoose').Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: payments,
      summary,
      pagination: {
        page: parseInt(page),
        const express = require('express');
        const asyncHandler = require('express-async-handler');
        const router = express.Router();
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching student payments:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment history' });
  }
});

// Get payment history for landlord
router.get('/landlord', authenticateLandlord, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { landlordId: req.user.id };
    if (status) query.status = status;

    const payments = await PaymentHistory.find(query)
