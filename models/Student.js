const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    // Basic Info
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /.+\@.+\..+/
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // Don't return password by default
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    
    // Academic Info
    studentId: {
      type: String,
      sparse: true,
      trim: true
    },
    university: {
      type: String,
      default: 'Chuka University'
    },
    course: {
      type: String,
      trim: true
    },
    yearOfStudy: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      sparse: true
    },
    
    // Account Status
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
    emailVerificationExpires: {
      type: Date
    },
    
    // Preferences
    preferredAreas: [{
      type: String,
      trim: true
    }],
    budget: {
      min: {
        type: Number,
        default: 5000
      },
      max: {
        type: Number,
        default: 15000
      }
    },
    amenitiesPreference: [{
      type: String,
      enum: ['WiFi', 'Water', 'Electricity', 'Furnished', 'Parking', 'Security', 'Shared Kitchen']
    }],
    
    // Access & Tokens
    accessTokens: [{
      token: String,
      purchasedAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: Date,
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    
    // Bookings & History
    bookings: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    }],
    savedHouses: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House'
    }],
    
    // Profile
    profilePicture: {
      type: String
    },
    bio: {
      type: String,
      maxlength: 500
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      count: {
        type: Number,
        default: 0
      }
    },
    
    // Payment Info
    paymentMethod: {
      type: {
        type: String,
        enum: ['M-Pesa', 'Credit Card', 'Bank Transfer']
      },
      details: mongoose.Schema.Types.Mixed
    },
    
    // Notifications
    notificationPreferences: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: true
      },
      newListings: {
        type: Boolean,
        default: true
      },
      priceAlerts: {
        type: Boolean,
        default: true
      }
    },
    
    // Timestamps & Status
    lastLogin: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Hash password before saving
studentSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
studentSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get full name
studentSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Check if student has active access token
studentSchema.methods.hasActiveAccess = function() {
  if (!this.accessTokens || this.accessTokens.length === 0) {
    return false;
  }

  const now = new Date();
  const activeToken = this.accessTokens.find(token => 
    token.isActive && token.expiresAt > now
  );
  
  return !!activeToken;
};

// Get remaining access time in hours
studentSchema.methods.getRemainingAccessTime = function() {
  if (!this.accessTokens || this.accessTokens.length === 0) {
    return 0;
  }

  const now = new Date();
  const activeToken = this.accessTokens.find(token => 
    token.isActive && token.expiresAt > now
  );
  
  if (!activeToken) {return 0;}

  const remainingMs = activeToken.expiresAt.getTime() - now.getTime();
  return Math.ceil(remainingMs / (1000 * 60 * 60)); // Convert to hours
};

// Add access token
studentSchema.methods.addAccessToken = function(expiresAt) {
  this.accessTokens.push({
    token: require('crypto').randomBytes(16).toString('hex'),
    purchasedAt: new Date(),
    expiresAt,
    isActive: true
  });
  return this.accessTokens[this.accessTokens.length - 1];
};

// Deactivate all tokens
studentSchema.methods.deactivateAllTokens = function() {
  this.accessTokens.forEach(token => {
    token.isActive = false;
  });
};

// Get public profile (without sensitive info)
studentSchema.methods.getPublicProfile = function() {
  const profile = this.toObject();
  delete profile.password;
  delete profile.emailVerificationToken;
  delete profile.accessTokens;
  delete profile.paymentMethod;
  return profile;
};

// Index for email lookup
studentSchema.index({ email: 1 }, { unique: true });
studentSchema.index({ studentId: 1 }, { unique: true, sparse: true });
studentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Student', studentSchema);
