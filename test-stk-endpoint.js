require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

// Import models
const User = require('./models/User');
const Room = require('./models/Room');
const CoreBooking = require('./models/CoreBooking');

const testEndpoint = async () => {
    try {
        console.log('🚀 Testing /api/core/pay Endpoint...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chuka-cribs');
        console.log('✅ MongoDB Connected\n');

        // Create test data
        console.log('📝 Setting up test data...');
        
        const user = await User.findOne({ phone: '0715255115' }) || 
            await User.create({
                name: 'Test Student',
                phone: '0715255115',
                email: 'test@chukacribs.com'
            });
        console.log(`✅ User: ${user.name} (${user.phone})`);

        const room = await Room.findOne({ name: 'Test Single Room' }) || 
            await Room.create({
                name: 'Test Single Room',
                price: 4000,
                description: 'Test room'
            });
        console.log(`✅ Room: ${room.name} (KSH ${room.price})`);

        const booking = await CoreBooking.create({
            user: user._id,
            room: room._id,
            status: 'PENDING'
        });
        console.log(`✅ Booking: ${booking._id}\n`);

        // Test the endpoint
        console.log('💳 Testing Endpoint: POST /api/core/pay');
        console.log('   Payload:', {
            bookingId: booking._id.toString(),
            phone: '0715255115'
        });
        console.log('   Try this curl command:\n');
        
        console.log(`curl -X POST http://localhost:3000/api/core/pay \\
  -H "Content-Type: application/json" \\
  -d '{
    "bookingId": "${booking._id.toString()}",
    "phone": "0715255115"
  }'\n`);

        console.log('='.repeat(70));
        console.log('📋 TEST DATA');
        console.log('='.repeat(70));
        console.log(`User ID:     ${user._id}`);
        console.log(`Room ID:     ${room._id}`);
        console.log(`Booking ID:  ${booking._id}`);
        console.log(`Phone:       0715255115`);
        console.log(`Amount:      KSH ${room.price}`);
        console.log('='.repeat(70));

        console.log('\n✅ Setup complete! Start server with: npm start');
        console.log('   Then run the curl command above to test the endpoint.\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        process.exit(1);
    }
};

testEndpoint();
