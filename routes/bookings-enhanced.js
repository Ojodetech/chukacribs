const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const Booking = require('../models/Booking');
const House = require('../models/House');
const Student = require('../models/Student');
const Landlord = require('../models/Landlord');
const Token = require('../models/Token');
const logger = require('../config/logger');
const { sendBookingNotification, sendBookingConfirmation } = require('../config/email');
const { sendBookingSMS } = require('../config/sms');
const { sendBookingConfirmationNotification } = require('./notifications');
const { authenticateStudent, authenticateLandlord } = require('../config/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Create Booking (with payment confirmation)
router.post('/', 
  [
    body('houseId').isMongoId().withMessage('Invalid house ID'),
    body('moveInDate').isISO8601().toDate().withMessage('Invalid move-in date'),
    body('userEmail').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('userName').trim().notEmpty().withMessage('User name is required'),
    body('userPhone').trim().notEmpty().withMessage('Phone number is required'),
    body('tokenUsed').trim().notEmpty().withMessage('Access token is required'),
    body('paymentId').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { houseId, moveInDate, userEmail, userName, userPhone, tokenUsed, paymentId, notes } = req.body;

      // Verify house exists
      const house = await House.findById(houseId);
      if (!house) {
        return res.status(404).json({
          success: false,
          message: 'House not found'
        });
      }

      // Check if student already has a pending booking for this house
      const existingBooking = await Booking.findOne({
        houseId,
        userEmail,
        status: { $in: ['pending', 'confirmed'] }
      });

      if (existingBooking) {
        return res.status(409).json({
          success: false,
          message: 'You already have a booking for this house'
        });
      }

      // Start transaction and reserve token for this booking attempt
      const session = await mongoose.startSession();
      session.startTransaction();

      let token;
      let booking;
      let landlord;

      try {
        token = await Token.reserveToken(tokenUsed, session);

        if (!token || token.isUsed) {
          await session.abortTransaction();
          session.endSession();
          return res.status(401).json({
            success: false,
            message: 'Invalid or already used access token'
          });
        }

        if (!token.expiresAt || token.expiresAt < new Date()) {
          await session.abortTransaction();
          session.endSession();
          return res.status(401).json({
            success: false,
            message: 'Access token has expired'
          });
        }

        booking = new Booking({
          houseId,
          moveInDate,
          userEmail: userEmail.toLowerCase(),
          userName,
          userPhone,
          tokenUsed,
          status: paymentId ? 'confirmed' : 'pending',
          notes
        });

        await booking.save({ session });

        // Mark token as used atomically with booking creation
        token.isUsed = true;
        token.usedAt = new Date();
        token.usedForBooking = booking._id;
        token.isLocked = false;
        token.lockExpiresAt = null;
        await token.save({ session });

        // Add booking to student record, if found
        const student = await Student.findOne({ email: userEmail.toLowerCase() }).session(session);
        if (student) {
          student.bookings = student.bookings || [];
          if (!student.bookings.includes(booking._id)) {
            student.bookings.push(booking._id);
          }
          await student.save({ session });
        }

        // Load landlord data for follow-up notifications
        landlord = await Landlord.findById(house.landlordId).session(session);

        await session.commitTransaction();
      } catch (txnError) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Booking creation transaction failed: ${txnError.message}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to create booking transactionally',
          error: txnError.message
        });
      } finally {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        session.endSession();
      }

      // Send SMS notification to student if booking is immediately confirmed (with payment)
      if (paymentId && userPhone) {
        sendBookingConfirmationNotification(
          userPhone,
          house.landlordId,
          house.title,
          userName,
          booking._id.toString()
        ).catch(error => {
          logger.warn(`Booking confirmation SMS notification failed: ${error.message}`);
        });
      }

      // Send notifications (non-blocking)
      Promise.all([
        // Email to student
        sendBookingConfirmation(userEmail, userName, house.title, moveInDate, booking._id),
        // Email to landlord
        landlord && sendBookingNotification(landlord.email, house.title, userName, userPhone, moveInDate),
        // SMS to student
        sendBookingSMS(userPhone, house.title, moveInDate)
      ]).catch(error => {
        logger.warn(`Notification send failed: ${error.message}`);
      });

      logger.info(`Booking created: ${booking._id} for ${userEmail}`);

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        booking: {
          id: booking._id,
          houseId: booking.houseId,
          status: booking.status,
          moveInDate: booking.moveInDate,
          bookingDate: booking.bookingDate,
          expiresAt: booking.expiresAt
        }
      });

    } catch (error) {
      logger.error(`Booking creation error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to create booking',
        error: error.message
      });
    }
  }
);

// Get Bookings for Student
router.get('/', authenticateStudent, async (req, res) => {
  try {
    const { status, sortBy = '-createdAt' } = req.query;
    
    const query = { userEmail: req.student.email };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('houseId', 'title location price images landlordId')
      .sort(sortBy)
      .lean();

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });

  } catch (error) {
    logger.error(`Get bookings error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// Get Booking Details
router.get('/:id', authenticateStudent, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('houseId')
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Verify ownership
    if (booking.userEmail !== req.student.email) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      booking
    });

  } catch (error) {
    logger.error(`Get booking detail error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: error.message
    });
  }
});

// Cancel Booking
router.patch('/:id/cancel', authenticateStudent, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.userEmail !== req.student.email) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled in current status'
      });
    }

    const moveInDate = new Date(booking.moveInDate);
    const now = new Date();
    const daysUntilMove = Math.ceil((moveInDate - now) / (1000 * 60 * 60 * 24));

    // Check cancellation policy
    if (daysUntilMove < 7) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel within 7 days of move-in date'
      });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    // Get landlord for notification
    const house = await House.findById(booking.houseId);
    const landlord = house && await Landlord.findById(house.landlordId);

    // Send notifications
    Promise.all([
      sendBookingConfirmation(booking.userEmail, booking.userName, 'Booking Cancelled', new Date()),
      landlord && sendBookingNotification(landlord.email, house.title, `${booking.userName} cancelled booking`, booking.userPhone)
    ]).catch(err => logger.warn(`Cancellation notification failed: ${err.message}`));

    logger.info(`Booking cancelled: ${booking._id}`);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
    });

  } catch (error) {
    logger.error(`Cancel booking error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
});

// Confirm Booking (for pending bookings)
// Sends SMS notification to landlord when booking is confirmed
router.patch('/:id/confirm', authenticateStudent, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.userEmail !== req.student.email) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be confirmed'
      });
    }

    booking.status = 'confirmed';
    booking.confirmedAt = new Date();
    await booking.save();

    // Get house and landlord info for SMS notification
    const house = await House.findById(booking.houseId);
    const landlord = await Landlord.findById(house.landlordId);

    // Send SMS notification to student when booking is confirmed
    if (booking.userPhone) {
      sendBookingConfirmationNotification(
        booking.userPhone,
        house.landlordId,
        house.title,
        booking.userName,
        booking._id.toString()
      ).catch(error => {
        logger.warn(`Booking confirmation SMS notification failed: ${error.message}`);
      });
    }

    logger.info(`Booking confirmed: ${booking._id}`, {
      bookingId: booking._id,
      landlordId: landlord._id,
      SMSNotificationSent: landlord && landlord.phoneNumber ? true : false
    });

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        confirmedAt: booking.confirmedAt,
        houseId: booking.houseId,
        landlordNotified: landlord && landlord.phoneNumber ? true : false
      }
    });

  } catch (error) {
    logger.error(`Confirm booking error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm booking',
      error: error.message
    });
  }
});

// Get Landlord's Bookings (Landlord access)
router.get('/landlord/all', authenticateLandlord, async (req, res) => {
  try {
    const { status, startDate, endDate, sortBy = '-createdAt' } = req.query;

    // Get all landlord's houses
    const houses = await House.find({ landlordId: req.landlord.id }).select('_id');
    const houseIds = houses.map(h => h._id);

    const query = { houseId: { $in: houseIds } };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.bookingDate = {};
      if (startDate) {query.bookingDate.$gte = new Date(startDate);}
      if (endDate) {query.bookingDate.$lte = new Date(endDate);}
    }

    const bookings = await Booking.find(query)
      .populate('houseId', 'title location')
      .sort(sortBy)
      .lean();

    // Summary stats
    const stats = {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      pending: bookings.filter(b => b.status === 'pending').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length
    };

    res.status(200).json({
      success: true,
      stats,
      bookings
    });

  } catch (error) {
    logger.error(`Get landlord bookings error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// Update Booking Status (Landlord)
router.patch('/landlord/:id/status', authenticateLandlord, async (req, res) => {
  try {
    const { status, message } = req.body;

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const booking = await Booking.findById(req.params.id).populate('houseId');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Verify landlord ownership
    const house = booking.houseId;
    if (house.landlordId.toString() !== req.landlord.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    booking.status = status;
    booking.statusMessage = message;
    booking.statusUpdatedAt = new Date();
    await booking.save();

    // Notify student
    sendBookingConfirmation(booking.userEmail, booking.userName, `Booking ${status}`, new Date())
      .catch(err => logger.warn(`Notification failed: ${err.message}`));

    logger.info(`Booking status updated: ${booking._id} to ${status}`);

    res.status(200).json({
      success: true,
      message: 'Booking status updated',
      booking
    });

  } catch (error) {
    logger.error(`Update booking status error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
});

// Get Booking Statistics
router.get('/stats/overview', authenticateStudent, async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      { $match: { userEmail: req.student.email } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      expired: 0
    };

    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });

    res.status(200).json({
      success: true,
      stats: result
    });

  } catch (error) {
    logger.error(`Get booking stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

module.exports = router;
