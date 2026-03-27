const mongoose = require('mongoose');

const siteReviewSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  rating: { type: Number, min: 1, max: 5 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedAt: Date,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

siteReviewSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SiteReview', siteReviewSchema);
