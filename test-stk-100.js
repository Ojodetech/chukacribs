require('dotenv').config();
process.env.NODE_ENV = 'production';
process.env.USE_MOCK_MPESA = 'false';

const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/User');
const Room = require('./models/Room');
const CoreBooking = require('./models/CoreBooking');

const testSTKPushWith100 = async () => {
    try {
        console.log('🚀 STK PUSH TEST FOR 0715255115 WITH 100 KSH\n');
        console.log('=' .repeat(70));

        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected\n');

        // Create/Get User
        console.log('👤 Creating/Getting user for 0715255115...');
        let user = await User.findOne({ phone: '0715255115' });
        
        if (!user) {
            user = await User.create({
                name: 'STK Test Student',
                phone: '0715255115',
                email: 'stktest@chukacribs.com'
            });
            console.log(`✅ User created: ${user._id}`);
        } else {
            console.log(`✅ User exists: ${user._id}`);
        }

        // Create/Get Room with 100 KSH price
        console.log('\n🏠 Creating/Getting test room with 100 KSH price...');
        let room = await Room.findOne({ price: 100 });
        
        if (!room) {
            room = await Room.create({
                name: 'STK Test Room 100',
                price: 100,
                description: 'Test room for STK push with 100 KSH'
            });
            console.log(`✅ Room created: ${room._id} - KSH ${room.price}`);
        } else {
            console.log(`✅ Room exists: ${room._id} - KSH ${room.price}`);
        }

        // Create New Booking
        console.log('\n📋 Creating new booking...');
        const booking = await CoreBooking.create({
            user: user._id,
            room: room._id,
            status: 'PENDING'
        });
        console.log(`✅ Booking created: ${booking._id}\n`);

        console.log('=' .repeat(70));
        console.log('📊 TEST DATA SUMMARY');
        console.log('=' .repeat(70));
        console.log(`Phone Number: 0715255115`);
        console.log(`User ID:      ${user._id}`);
        console.log(`Room ID:      ${room._id}`);
        console.log(`Booking ID:   ${booking._id}`);
        console.log(`Amount:       KSH ${room.price} ⭐ (DEFAULT AMOUNT)`);
        console.log('=' .repeat(70) + '\n');

        // Test the endpoint
        console.log('💳 INITIATING STK PUSH...\n');

        const paymentPayload = {
            bookingId: booking._id.toString(),
            phone: '0715255115'
        };

        console.log('Request Payload:');
        console.log(JSON.stringify(paymentPayload, null, 2) + '\n');

        const response = await axios.post('http://localhost:3000/api/core/pay', paymentPayload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log('✅ STK PUSH SUCCESSFUL!\n');
        console.log('=' .repeat(70));
        console.log('RESPONSE DATA:');
        console.log('=' .repeat(70));
        console.log(JSON.stringify(response.data, null, 2));
        console.log('=' .repeat(70) + '\n');

        // Extract key info
        if (response.data.checkoutId) {
            console.log(`🔔 Checkout ID: ${response.data.checkoutId}`);
        }
        if (response.data.payment?.amount) {
            console.log(`💰 Amount: KSH ${response.data.payment.amount}`);
        }
        if (response.data.message) {
            console.log(`📝 Message: ${response.data.message}`);
        }

        console.log('\n📱 STK Push has been sent to 0715255115');
        console.log('💵 Amount: KSH 100');
        console.log('👉 Check your phone for the M-Pesa prompt!\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR OCCURRED!\n');
        console.log('=' .repeat(70));
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log('Error Response:');
            console.log(JSON.stringify(error.response.data, null, 2));
        } else if (error.message) {
            console.log(`Error: ${error.message}`);
            if (error.code) {
                console.log(`Code: ${error.code}`);
            }
        } else {
            console.log(error);
        }
        console.log('=' .repeat(70) + '\n');
        
        try {
            await mongoose.connection.close();
        } catch (e) {}
        
        process.exit(1);
    }
};

testSTKPushWith100();
