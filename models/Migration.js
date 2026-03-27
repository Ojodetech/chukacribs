const mongoose = require('mongoose');

const migrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      description: 'Unique name of the migration file (timestamp_description)'
    },
    version: {
      type: String,
      required: true,
      description: 'Semantic version of the migration'
    },
    description: {
      type: String,
      required: true,
      description: 'Human-readable description of what the migration does'
    },
    executedAt: {
      type: Date,
      default: Date.now,
      description: 'When the migration was executed'
    },
    duration: {
      type: Number,
      description: 'Execution time in milliseconds'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'rolled_back'],
      default: 'completed'
    },
    error: {
      type: String,
      description: 'Error message if migration failed'
    },
    checksum: {
      type: String,
      description: 'Hash of migration file content to detect changes'
    },
    batch: {
      type: Number,
      description: 'Batch number indicating which run this was part of'
    },
    rollbackable: {
      type: Boolean,
      default: true,
      description: 'Whether this migration can be rolled back'
    },
    notes: {
      type: String,
      description: 'Additional notes about the migration'
    },
    executedBy: {
      type: String,
      default: 'system',
      description: 'User or system that executed the migration'
    }
  },
  {
    timestamps: true,
    collection: 'migrations'
  }
);

// Index for tracking migration status and batch
migrationSchema.index({ status: 1, executedAt: -1 });
migrationSchema.index({ batch: 1 });

// Static methods
migrationSchema.statics.getLastBatch = async function() {
  const lastMigration = await this.findOne().sort({ batch: -1 });
  return lastMigration ? lastMigration.batch : 0;
};

migrationSchema.statics.getPendingMigrations = async function() {
  return this.find({ status: 'pending' }).sort({ name: 1 });
};

migrationSchema.statics.getCompletedMigrations = async function() {
  return this.find({ status: 'completed' }).sort({ executedAt: -1 });
};

migrationSchema.statics.getFailedMigrations = async function() {
  return this.find({ status: 'failed' }).sort({ executedAt: -1 });
};

migrationSchema.statics.recordMigration = async function(data) {
  const migration = new this(data);
  return migration.save();
};

migrationSchema.statics.rollbackMigration = async function(name) {
  return this.findOneAndUpdate(
    { name },
    { status: 'rolled_back', updatedAt: new Date() },
    { new: true }
  );
};

// Instance methods
migrationSchema.methods.toJSON = function() {
  const obj = this.toObject();
  return {
    id: obj._id,
    name: obj.name,
    version: obj.version,
    description: obj.description,
    status: obj.status,
    executedAt: obj.executedAt,
    duration: obj.duration,
    error: obj.error,
    batch: obj.batch,
    rollbackable: obj.rollbackable,
    executedBy: obj.executedBy
  };
};

const Migration = mongoose.model('Migration', migrationSchema);

module.exports = Migration;
