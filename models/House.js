const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      enum: ['single', 'double', 'apartment', 'bedsitter'],
      required: true
    },
    bedrooms: {
      type: Number,
      min: 0,
      default: 1
    },
    units: {
      type: Number,
      min: 1,
      default: 1
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    images: [{
      type: String,
      required: true
    }],
    videos: [{
      type: String
    }],
    features: [{
      type: String
    }],
    amenities: {
      wifi: {
        type: Boolean,
        default: false
      },
      water: {
        type: Boolean,
        default: false
      },
      electricity: {
        type: Boolean,
        default: false
      }
    },
    landlord: {
      type: String,
      required: true,
      trim: true
    },
    landlordEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    landlordPhone: {
      type: String,
      required: true,
      trim: true
    },
    contact: {
      type: String,
      required: true,
      trim: true
    },
    available: {
      type: Boolean,
      default: true,
      index: true
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    views: {
      type: Number,
      default: 0
    },
    approved: {
      type: Boolean,
      default: false,
      index: true
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Landlord'
    },
    status: {
      type: String,
      enum: ['pending', 'published', 'archived'],
      default: 'pending'
    },
    submittedBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Index for searches
houseSchema.index({ title: 'text', location: 'text', description: 'text' });

module.exports = mongoose.model('House', houseSchema);