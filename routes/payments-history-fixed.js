const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const PaymentHistory = require('../models/PaymentHistory');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const { authenticateStudent, authenticateLandlord } = require('../config/auth');
const { body, validationResult } = require('express-validator');

// Get payment history for student
router.get('/student', authenticateStudent, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, startDate, endDate } = req.query;
  const skip = (page - 1) * limit;

  const query = { studentId: req.user.id };
  if (status) {query.status = status;}
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {query.createdAt.$gte = new Date(startDate);}
    if (endDate) {query.createdAt.$lte = new Date(endDate);}
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
    { $match: { studentId: mongoose.Types.ObjectId(req.user.id) } },
    { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  res.json({ success: true, data: payments, summary, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
}));

// Get payment history for landlord
router.get('/landlord', authenticateLandlord, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const query = { landlordId: req.landlordId || req.user?.id };
  if (status) {query.status = status;}

  const payments = await PaymentHistory.find(query)
    .populate('bookingId', 'checkInDate checkOutDate')
    .populate('houseId', 'title')
    .populate('studentId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await PaymentHistory.countDocuments(query);

  const summary = await PaymentHistory.aggregate([
    { $match: { landlordId: mongoose.Types.ObjectId(req.landlordId || req.user?.id) } },
    { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  res.json({ success: true, data: payments, summary, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
}));

// Get single payment
router.get('/:paymentId', asyncHandler(async (req, res) => {
  const payment = await PaymentHistory.findById(req.params.paymentId)
    .populate('bookingId')
    .populate('studentId', 'firstName lastName email phone')
    .populate('landlordId', 'name email phone')
    .populate('houseId', 'title location');

  if (!payment) {return res.status(404).json({ success: false, message: 'Payment not found' });}
  res.json({ success: true, data: payment });
}));

// Record payment - M-PESA ONLY
router.post('/record', authenticateStudent, body('bookingId').notEmpty(), body('amount').isFloat({ min: 0 }), body('paymentMethod').isIn(['M-Pesa']), body('transactionId').notEmpty(), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {return res.status(400).json({ success: false, errors: errors.array() });}

  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) {return res.status(404).json({ success: false, message: 'Booking not found' });}

  const existingPayment = await PaymentHistory.findOne({ transactionId: req.body.transactionId });
  if (existingPayment) {return res.status(400).json({ success: false, message: 'Payment already recorded' });}

  const payment = new PaymentHistory({
    bookingId: req.body.bookingId,
    studentId: req.user.id,
    landlordId: booking.landlordId,
    houseId: booking.houseId,
    amount: req.body.amount,
    paymentMethod: req.body.paymentMethod,
    transactionId: req.body.transactionId,
    notes: req.body.notes,
  });

  await payment.save();
  booking.paymentStatus = 'completed';
  await booking.save();

  res.status(201).json({ success: true, message: 'Payment recorded successfully', data: payment });
}));

// Generate receipt
router.get('/:paymentId/receipt', asyncHandler(async (req, res) => {
  if (typeof PaymentHistory.generateReceipt === 'function') {
    const receipt = await PaymentHistory.generateReceipt(req.params.paymentId);
    if (!receipt) {return res.status(404).json({ success: false, message: 'Receipt not available' });}
    return res.json({ success: true, data: receipt });
  }

  const payment = await PaymentHistory.findById(req.params.paymentId);
  if (!payment) {return res.status(404).json({ success: false, message: 'Payment not found' });}

  // Fallback receipt
  const receipt = {
    paymentId: payment._id,
    amount: payment.amount,
    date: payment.createdAt,
    method: payment.paymentMethod,
    bookingId: payment.bookingId,
  };

  res.json({ success: true, data: receipt });
}));

// Mark payment as completed (landlord/admin)
router.patch('/:paymentId/complete', authenticateLandlord, asyncHandler(async (req, res) => {
  const payment = await PaymentHistory.findById(req.params.paymentId);
  if (!payment) {return res.status(404).json({ success: false, message: 'Payment not found' });}

  payment.status = 'completed';
  if (typeof payment.markCompleted === 'function') {await payment.markCompleted();}
  await payment.save();

  res.json({ success: true, message: 'Payment marked as completed', data: payment });
}));

// Process refund
router.post('/:paymentId/refund', authenticateLandlord, body('refundAmount').isFloat({ min: 0 }), body('reason').optional().trim(), asyncHandler(async (req, res) => {
  const payment = await PaymentHistory.findById(req.params.paymentId);
  if (!payment) {return res.status(404).json({ success: false, message: 'Payment not found' });}

  const { refundAmount, reason } = req.body;
  if (typeof payment.refund === 'function') {
    await payment.refund(refundAmount, reason);
  } else {
    payment.status = 'refunded';
    payment.refund = { amount: refundAmount, reason, refundedAt: new Date() };
    await payment.save();
  }

  res.json({ success: true, message: 'Refund processed successfully', data: payment });
}));

module.exports = router;
