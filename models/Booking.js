const mongoose = require('mongoose');

// Get booking expiration hours from env (default: 24 hours)
const BOOKING_EXPIRATION_HOURS = parseInt(process.env.BOOKING_EXPIRATION_HOURS || '24');
const EXPIRATION_TIME_MS = BOOKING_EXPIRATION_HOURS * 60 * 60 * 1000;

const bookingSchema = new mongoose.Schema(
  {
    houseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      required: true
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    userName: {
      type: String,
      required: true,
      trim: true
    },
    userPhone: {
      type: String,
      required: true,
      trim: true
    },
    bookingDate: {
      type: Date,
      default: Date.now
    },
    moveInDate: {
      type: Date,
      required: true
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + EXPIRATION_TIME_MS)
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'expired'],
      default: 'pending',
      index: true
    },
    tokenUsed: {
      type: String,
      required: true
    },
    smsSent: {
      type: Boolean,
      default: false
    },
    smsMessage: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// TTL Index - Auto-delete expired bookings after 24 hours
bookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for user queries
bookingSchema.index({ userEmail: 1, status: 1 });
bookingSchema.index({ houseId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);