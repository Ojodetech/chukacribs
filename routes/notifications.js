const express = require('express');
const { body, validationResult } = require('express-validator');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Landlord = require('../models/Landlord');
const logger = require('../config/logger');
const { sendNotificationEmail, sendNotificationSMS } = require('../config/email');
const smsNotifications = require('../config/smsNotifications');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Create Notification (Internal - triggered by other routes)
async function createNotification(userId, userType, title, message, type, data = {}) {
  try {
    const notification = new Notification({
      userId,
      userType,
      title,
      message,
      type,
      data,
      isRead: false
    });

    await notification.save();
    return notification;
  } catch (error) {
    logger.error(`Notification creation error: ${error.message}`);
    return null;
  }
}

/**
 * Send SMS notification to landlord on booking confirmation
 * Format: Name + Contact + Thank you message
 */
async function sendLandlordNotificationSMS(landlord, subject, details) {
  try {
    if (!landlord.phoneNumber) {
      logger.warn(`Landlord ${landlord._id} has no phone number for SMS`);
      return false;
    }

    // Use the dedicated SMS notification function from config
    const result = await smsNotifications.sendBookingConfirmationSMS(landlord, details);
    
    return result.success;
  } catch (error) {
    logger.error(`Send landlord notification SMS error: ${error.message}`);
    return false;
  }
}

// Send Booking Confirmation Notification
// Called when a booking is CONFIRMED by the student (not when created)
async function sendBookingConfirmationNotification(studentPhone, landlordId, houseTitle, studentName, bookingId) {
  try {
    const landlord = await Landlord.findById(landlordId);
    if (!landlord) {return;}

    const notification = await createNotification(
      landlordId,
      'landlord',
      'Booking Confirmed',
      `${studentName} confirmed booking for ${houseTitle}`,
      'booking_confirmed',
      { studentName, studentPhone, houseTitle, bookingId }
    );

    // Send SMS notification to STUDENT when booking is confirmed
    if (studentPhone) {
      const smsResult = await smsNotifications.sendBookingConfirmationSMS(studentPhone, {
        studentName: studentName,
        landlordName: `${landlord.firstName || ''} ${landlord.lastName || ''}`.trim(),
        landlordContact: landlord.phoneNumber || 'Not provided',
        propertyName: houseTitle,
        bookingId: bookingId
      });

      if (smsResult.success) {
        logger.info(`Booking confirmation SMS sent to student`, { phoneNumber: studentPhone, messageId: smsResult.messageId });
      } else {
        logger.warn(`Booking confirmation SMS failed for student`, { phoneNumber: studentPhone, reason: smsResult.reason });
      }
    }

    // Send email to LANDLORD
    if (landlord.emailVerified) {
      sendNotificationEmail(landlord.email, 'Booking Confirmed', notification.message)
        .catch(err => logger.warn(`Email notification failed: ${err.message}`));
    }

    return notification;
  } catch (error) {
    logger.error(`Send booking confirmation notification error: ${error.message}`);
  }
}

// Send Price Alert
async function sendPriceAlert(studentId, houseName, newPrice, oldPrice) {
  try {
    const student = await Student.findById(studentId);
    if (!student || !student.notificationPreferences.priceAlerts) {return;}

    const notification = await createNotification(
      studentId,
      'student',
      'Price Update',
      `${houseName} price changed from ${oldPrice} to ${newPrice}`,
      'price_alert',
      { houseName, newPrice, oldPrice }
    );

    // Send email
    if (student.emailVerified) {
      sendNotificationEmail(student.email, 'Price Update', notification.message)
        .catch(err => logger.warn(`Email notification failed: ${err.message}`));
    }

    return notification;
  } catch (error) {
    logger.error(`Send price alert error: ${error.message}`);
  }
}

// Get Notifications (User)
router.get('/', authenticate, async (req, res) => {
  try {
    const { read, limit = 10, skip = 0, type } = req.query;

    const query = { userId: req.user.id };

    if (read !== undefined) {
      query.isRead = read === 'true';
    }

    if (type) {
      query.type = type;
    }

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      total,
      unreadCount,
      notifications
    });

  } catch (error) {
    logger.error(`Get notifications error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// Mark Notification as Read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    logger.error(`Mark read error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: error.message
    });
  }
});

// Mark All as Read
router.patch('/read-all/bulk', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    logger.error(`Mark all read error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications',
      error: error.message
    });
  }
});

// Delete Notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });

  } catch (error) {
    logger.error(`Delete notification error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

// Get Notification Preferences
router.get('/preferences/get', authenticate, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('notificationPreferences');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      preferences: student.notificationPreferences
    });

  } catch (error) {
    logger.error(`Get preferences error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences',
      error: error.message
    });
  }
});

// Update Notification Preferences
router.patch('/preferences/update', authenticate, async (req, res) => {
  try {
    const { email, sms, newListings, priceAlerts } = req.body;

    const student = await Student.findByIdAndUpdate(
      req.user.id,
      {
        'notificationPreferences.email': email ?? undefined,
        'notificationPreferences.sms': sms ?? undefined,
        'notificationPreferences.newListings': newListings ?? undefined,
        'notificationPreferences.priceAlerts': priceAlerts ?? undefined
      },
      { new: true }
    ).select('notificationPreferences');

    res.status(200).json({
      success: true,
      message: 'Preferences updated',
      preferences: student.notificationPreferences
    });

  } catch (error) {
    logger.error(`Update preferences error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
});

// Authentication Middleware
function authenticate(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = { id: decoded.userId, role: decoded.role };
    next();

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: error.message
    });
  }
}

// Export helper functions
module.exports = router;
module.exports.createNotification = createNotification;
module.exports.sendBookingConfirmationNotification = sendBookingConfirmationNotification;
module.exports.sendPriceAlert = sendPriceAlert;
module.exports.sendLandlordNotificationSMS = sendLandlordNotificationSMS;
