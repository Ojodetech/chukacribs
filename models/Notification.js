const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userType: {
      type: String,
      enum: ['student', 'landlord', 'admin'],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['booking', 'payment', 'message', 'price_alert', 'new_listing', 'system', 'alert', 'other'],
      default: 'other'
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: Date,
    
    // Delivery channels
    channels: {
      inApp: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: false,
        sent: Date,
        failed: Boolean,
        error: String
      },
      sms: {
        type: Boolean,
        default: false,
        sent: Date,
        failed: Boolean,
        error: String
      },
      push: {
        type: Boolean,
        default: false,
        sent: Date,
        failed: Boolean,
        error: String
      }
    },
    
    // Expiration
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    },
    
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Auto-delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for common queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
