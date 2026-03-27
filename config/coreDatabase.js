const mongoose = require('mongoose');

const connectCoreDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chuka-cribs');
        console.log('✅ MongoDB Connected');
        return mongoose.connection;
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    }
};

module.exports = connectCoreDB;
