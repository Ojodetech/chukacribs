const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaymentSchema = new Schema({
  amount: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ['pending','completed','failed','verified'], default: 'pending' },
  method: { type: String },
  booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
  student: { type: Schema.Types.ObjectId, ref: 'Student' },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date }
});

module.exports = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
