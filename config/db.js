const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ FATAL: Missing MONGODB_URI environment variable.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected successfully.');
    return true;
  } catch (err) {
    console.error('⚠️ MongoDB connection error:', err.message);
    console.warn('⚠️ Falling back to in-memory/sample data mode.');
    return false;
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected.');
  });
};

module.exports = connectDB;
