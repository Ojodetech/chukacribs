const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    houseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      required: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    reminderDate: {
      type: Date,
    },
    bookmarkName: {
      type: String,
      maxlength: 100,
    },
  },
  { timestamps: true }
);

// Compound index for efficient querying
favoriteSchema.index({ studentId: 1, houseId: 1 }, { unique: true });
favoriteSchema.index({ studentId: 1, createdAt: -1 });
favoriteSchema.index({ houseId: 1 });

// Static method to toggle favorite
favoriteSchema.statics.toggleFavorite = async function (studentId, houseId) {
  const existing = await this.findOne({ studentId, houseId });

  if (existing) {
    await this.deleteOne({ _id: existing._id });
    return { favorited: false, message: 'Removed from favorites' };
  } else {
    const favorite = new this({ studentId, houseId });
    await favorite.save();
    return { favorited: true, message: 'Added to favorites' };
  }
};

// Method to get favorite count for a house
favoriteSchema.statics.getFavoriteCount = async function (houseId) {
  return await this.countDocuments({ houseId });
};

// Virtual for favorited status when querying houses
favoriteSchema.virtual('isFavorited').get(function () {
  return true;
});

module.exports = mongoose.model('Favorite', favoriteSchema);
