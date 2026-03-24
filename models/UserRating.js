const mongoose = require('mongoose');

const userRatingSchema = new mongoose.Schema(
  {
    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'ratedByType',
    },
    ratedByType: {
      type: String,
      enum: ['Student', 'Landlord'],
      required: true,
    },
    ratedUser: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'ratedUserType',
    },
    ratedUserType: {
      type: String,
      enum: ['Student', 'Landlord'],
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    categories: {
      communication: { type: Number, min: 1, max: 5 },
      cleanliness: { type: Number, min: 1, max: 5 },
      accuracy: { type: Number, min: 1, max: 5 },
      location: { type: Number, min: 1, max: 5 },
      value: { type: Number, min: 1, max: 5 },
    },
    comment: {
      type: String,
      maxlength: 1000,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    anonymous: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for user uniqueness
userRatingSchema.index({ ratedBy: 1, ratedUser: 1, bookingId: 1 }, { unique: true });
userRatingSchema.index({ ratedUser: 1, ratedUserType: 1, createdAt: -1 });
userRatingSchema.index({ ratedBy: 1, createdAt: -1 });

// Static method to calculate trust score
userRatingSchema.statics.calculateTrustScore = async function (userId, userType) {
  const ratings = await this.find({
    ratedUser: userId,
    ratedUserType: userType,
    verified: true,
  });

  if (ratings.length === 0) {
    return {
      score: 50,
      rating: 0,
      count: 0,
      breakdown: {
        communication: 0,
        cleanliness: 0,
        accuracy: 0,
        location: 0,
        value: 0,
      },
      trustLevel: 'UNRATED',
    };
  }

  const avgRating =
    ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

  // Calculate category averages
  const categories = {
    communication: 0,
    cleanliness: 0,
    accuracy: 0,
    location: 0,
    value: 0,
  };

  const categoryCount = { ...categories };
  ratings.forEach((rating) => {
    Object.keys(categories).forEach((cat) => {
      if (rating.categories[cat]) {
        categories[cat] += rating.categories[cat];
        categoryCount[cat]++;
      }
    });
  });

  Object.keys(categories).forEach((cat) => {
    if (categoryCount[cat] > 0) {
      categories[cat] = (categories[cat] / categoryCount[cat]).toFixed(2);
    }
  });

  // Calculate trust score (0-100)
  const trustScore =
    Math.min(100, (avgRating / 5) * 100 + Math.min(ratings.length * 2, 20));

  // Determine trust level
  let trustLevel = 'LOW';
  if (trustScore >= 80) {trustLevel = 'EXCELLENT';}
  else if (trustScore >= 60) {trustLevel = 'GOOD';}
  else if (trustScore >= 40) {trustLevel = 'FAIR';}

  return {
    score: Math.round(trustScore),
    rating: avgRating.toFixed(2),
    count: ratings.length,
    breakdown: categories,
    trustLevel,
    lastRatedAt: ratings[0].createdAt,
  };
};

module.exports = mongoose.model('UserRating', userRatingSchema);
