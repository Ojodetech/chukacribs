const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema(
  {
    // Identification
    referenceId: {
      type: String,
      sparse: true,
      index: true
    },
    
    // PesaPal specific
    orderTrackingId: {
      type: String,
      sparse: true,
      index: true
    },
    transactionId: {
      type: String,
      sparse: true
    },
    
    // Access token issued for bookings/payment
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    // User information
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      sparse: true,
      trim: true,
      lowercase: true
    },
    
    // Payment details
    amount: {
      type: Number,
      default: 100,
      required: true
    },
    currency: {
      type: String,
      default: 'KES'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },
    paymentGateway: {
      type: String,
      enum: ['mpesa'],
      default: 'mpesa'
    },
    
    // Legacy M-Pesa fields
    mpesaReceiptNumber: {
      type: String,
      sparse: true
    },
    
    // Token usage and locking (for atomic token consumption in concurrent booking flows)
    isUsed: {
      type: Boolean,
      default: false,
      index: true
    },
    isLocked: {
      type: Boolean,
      default: false,
      index: true
    },
    lockExpiresAt: {
      type: Date,
      default: null
    },
    // Timestamps
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// TTL Index to automatically delete expired tokens after expiration
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Atomically reserve a token for processing
 * Returns token document when reserved successfully; otherwise null
 */
tokenSchema.statics.reserveToken = async function(tokenValue, session = null) {
  const now = new Date();
  return this.findOneAndUpdate(
    {
      token: tokenValue,
      isUsed: false,
      isLocked: false,
      expiresAt: { $gt: now }
    },
    {
      $set: {
        isLocked: true,
        lockExpiresAt: new Date(Date.now() + 2 * 60 * 1000) // 2 minute lock
      }
    },
    { new: true, session }
  );
};

module.exports = mongoose.model('Token', tokenSchema);