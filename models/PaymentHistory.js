const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Landlord',
      required: true,
    },
    houseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'KES',
    },
    paymentMethod: {
      type: String,
      enum: ['M-Pesa', 'PesaPal', 'Bank Transfer', 'Card', 'Cash'],
      required: true,
    },
    transactionId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paidAt: Date,
    refundedAt: Date,
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundReason: String,
    notes: String,
    receiptUrl: String,
    receiptGeneratedAt: Date,
  },
  { timestamps: true }
);

// Indexes for efficient querying
paymentHistorySchema.index({ studentId: 1, createdAt: -1 });
paymentHistorySchema.index({ landlordId: 1, createdAt: -1 });
paymentHistorySchema.index({ status: 1, createdAt: -1 });
paymentHistorySchema.index({ bookingId: 1 }, { unique: true });
paymentHistorySchema.index({ transactionId: 1 }, { unique: true });

// Static method to generate receipt
paymentHistorySchema.statics.generateReceipt = async function (paymentId) {
  const payment = await this.findById(paymentId)
    .populate('bookingId')
    .populate('studentId', 'firstName lastName email')
    .populate('landlordId', 'name email')
    .populate('houseId', 'title location');

  if (!payment) {throw new Error('Payment not found');}

  return {
    receiptNumber: `RCP-${payment._id.toString().slice(-8).toUpperCase()}`,
    date: payment.paidAt || new Date(),
    student: payment.studentId,
    landlord: payment.landlordId,
    house: payment.houseId,
    booking: {
      checkIn: payment.bookingId?.checkInDate,
      checkOut: payment.bookingId?.checkOutDate,
      duration: payment.bookingId?.duration,
    },
    amount: payment.amount,
    currency: payment.currency,
    method: payment.paymentMethod,
    transactionId: payment.transactionId,
    status: payment.status,
  };
};

// Method to mark payment as completed
paymentHistorySchema.methods.markCompleted = async function () {
  this.status = 'completed';
  this.paidAt = new Date();
  return await this.save();
};

// Method to process refund
paymentHistorySchema.methods.refund = async function (refundAmount, reason) {
  if (refundAmount > this.amount) {
    throw new Error('Refund amount exceeds payment amount');
  }

  this.status = 'refunded';
  this.refundedAt = new Date();
  this.refundAmount = refundAmount;
  this.refundReason = reason;
  return await this.save();
};

// Virtual for payment completion percentage
paymentHistorySchema.virtual('completionPercentage').get(function () {
  if (this.status === 'completed') {return 100;}
  if (this.status === 'refunded') {return 0;}
  return 50;
});

module.exports = mongoose.model('PaymentHistory', paymentHistorySchema);
