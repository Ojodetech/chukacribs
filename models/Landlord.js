const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const landlordSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /.+\@.+\..+/
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    idNumber: {
      type: String,
      required: true,
      unique: true
    },
    bankName: {
      type: String,
      trim: true
    },
    bankAccount: {
      type: String,
      trim: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String
    },
    emailVerificationExpiry: {
      type: Date
    },
    unverifiedAccountCanResetAt: {
      type: Date,
      description: 'When an unverified account can be reset/deleted and re-registered (default: 7 days after creation)'
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    phoneVerificationCode: {
      type: String
    },
    phoneVerificationExpiry: {
      type: Date
    },
    profilePicture: {
      type: String
    },
    properties: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House'
    }],
    totalBookings: {
      type: Number,
      default: 0
    },
    totalViews: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
landlordSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
landlordSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON response
landlordSchema.methods.toJSON = function() {
  const { password, ...user } = this.toObject();
  return user;
};

module.exports = mongoose.model('Landlord', landlordSchema);