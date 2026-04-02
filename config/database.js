const mongoose = require('mongoose');

// Load from environment or use default
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chukacribs';

const connectDB = async () => {
  try {
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable not set');
    }

    if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.ADMIN_SECRET_KEY)) {
      throw new Error('JWT_SECRET and ADMIN_SECRET_KEY must be set for secure operation');
    }
    
    if (mongoURI.includes('localhost') && process.env.NODE_ENV === 'production') {
      throw new Error('Cannot use localhost MongoDB in production');
    }

    const connectionOptions = {
      maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
      minPoolSize: process.env.NODE_ENV === 'production' ? 10 : 5,
      maxIdleTimeMS: 120000,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      family: 4,
      retryWrites: true,
      retryReads: true,
      writeConcern: { w: 'majority' },
      monitorCommands: true,
      heartbeatFrequencyMS: 30000
      // Removed deprecated options: useNewUrlParser and useUnifiedTopology (default in Mongoose 6+)
    };

    console.log(`🔄 Connecting to MongoDB (${mongoURI.split('@')[1] || 'local'})...`);
    console.log(`   Pool size: ${connectionOptions.minPoolSize}-${connectionOptions.maxPoolSize}`);
    console.log(`   Timeouts: serverSelection=${connectionOptions.serverSelectionTimeoutMS}ms, socket=${connectionOptions.socketTimeoutMS}ms`);
    
    // Register event listeners BEFORE connecting
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
      console.log(`   Connection pool: min=${connectionOptions.minPoolSize}, max=${connectionOptions.maxPoolSize}`);
    });

    mongoose.connection.on('error', (err) => {
      console.error(' MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn(' MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log(' MongoDB reconnected successfully');
    });
    
    mongoose.connection.on('open', () => {
      console.log(' MongoDB connection pool opened');
    });
    
    mongoose.connection.on('close', () => {
      console.log(' MongoDB connection pool closed');
    });

    await mongoose.connect(mongoURI, connectionOptions);
    return true;
  } catch (error) {
    console.error(' MongoDB connection error:', error.message);
    console.log(' Falling back to sample data mode');
    return false;
  }
};

connectDB.close = async () => {
  try {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch (error) {
    console.warn('Failed to close MongoDB connection cleanly:', error.message);
  }
};

module.exports = connectDB;
