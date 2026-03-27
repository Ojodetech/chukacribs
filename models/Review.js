const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    houseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Landlord'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      enum: [1, 2, 3, 4, 5]
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    categories: {
      cleanliness: { type: Number, min: 1, max: 5 },
      landlordResponse: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
      location: { type: Number, min: 1, max: 5 },
      amenities: { type: Number, min: 1, max: 5 }
    },
    verified: {
      type: Boolean,
      default: false,
      index: true
    },
    helpful: {
      count: { type: Number, default: 0 },
      upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
      downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    landlordResponse: {
      text: String,
      respondedAt: Date
    },
    bookedFor: {
      checkIn: Date,
      checkOut: Date,
      duration: Number // in days
    },
    photos: [String],
    tags: [String],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Compound index for finding verified reviews
reviewSchema.index({ houseId: 1, verified: 1, createdAt: -1 });
reviewSchema.index({ studentId: 1, verified: 1 });
reviewSchema.index({ status: 1 });

// Calculate average rating method
reviewSchema.statics.getAverageRating = async function(houseId) {
  const stats = await this.aggregate([
    { $match: { houseId: mongoose.Types.ObjectId(houseId), verified: true } },
    {
      $group: {
        _id: '$houseId',
        average: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);

  return stats.length > 0 ? stats[0] : { average: 0, count: 0 };
};

// Update house rating after review save
reviewSchema.post('save', async function() {
  if (this.verified) {
    const stats = await this.constructor.getAverageRating(this.houseId);
    await mongoose.model('House').findByIdAndUpdate(this.houseId, {
      'rating.average': stats.average,
      'rating.count': stats.count
    });
  }
});

module.exports = mongoose.model('Review', reviewSchema);
