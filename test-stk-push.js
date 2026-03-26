require('dotenv').config();

// ENFORCE PRODUCTION MODE
process.env.NODE_ENV = 'production';
process.env.USE_MOCK_MPESA = 'false';

const mongoose = require('mongoose');
const axios = require('axios');

// Import models
const User = require('./models/User');
const Room = require('./models/Room');
const CoreBooking = require('./models/CoreBooking');
const CorePayment = require('./models/CorePayment');

const testSTKPush = async () => {
    try {
        console.log('🚀 STK Push Test Started...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chuka-cribs');
        console.log('✅ MongoDB Connected\n');

        // 1. Create test user
        console.log('📝 Step 1: Creating test user...');
        const testUser = await User.create({
            name: 'Test Student',
            phone: '0715255115',
            email: 'test@chukacribs.com',
            role: 'tenant'
        }).catch(err => {
            if (err.code === 11000) {
                console.log('⚠️ User already exists, fetching...');
                return User.findOne({ phone: '0715255115' });
            }
            throw err;
        });
        console.log(`✅ User created/fetched:`, testUser._id);
        console.log(`   Name: ${testUser.name}`);
        console.log(`   Phone: ${testUser.phone}\n`);

        // 2. Create test room
        console.log('📝 Step 2: Creating test room...');
        const testRoom = await Room.create({
            name: 'Test Single Room',
            price: 4000,
            description: 'Test room for STK Push',
            amenities: ['WiFi', 'Cooking']
        });
        console.log(`✅ Room created:`, testRoom._id);
        console.log(`   Name: ${testRoom.name}`);
        console.log(`   Price: KSH ${testRoom.price}`);
        console.log(`   Occupied: ${testRoom.isOccupied}\n`);

        // 3. Create booking
        console.log('📝 Step 3: Creating booking...');
        const testBooking = await CoreBooking.create({
            user: testUser._id,
            room: testRoom._id,
            status: 'PENDING'
        });
        console.log(`✅ Booking created:`, testBooking._id);
        console.log(`   Status: ${testBooking.status}`);
        console.log(`   Amount: KSH ${testRoom.price}\n`);

        // 4. Test STK Push endpoint
        console.log('💳 Step 4: Initiating STK Push Payment...');
        console.log('   Endpoint: POST /api/core/pay');
        console.log(`   Payload:`, JSON.stringify({
            bookingId: testBooking._id.toString(),
            phone: '0715255115'
        }, null, 2));

        // Import the initiateSTKPush function
        const { initiateSTKPush } = require('./config/mpesa');

        console.log('\n⏳ Calling M-Pesa STK Push API...');
        const stkResponse = await initiateSTKPush('0715255115', testRoom.price, testBooking._id.toString());

        console.log('\n✅ STK Push Response:');
        console.log(JSON.stringify(stkResponse, null, 2));

        // 5. Check payment record
        console.log('\n📋 Step 5: Checking payment record...');
        const payment = await CorePayment.findOne({
            booking: testBooking._id
        }).populate('booking');

        if (payment) {
            console.log('✅ Payment record created:');
            console.log(`   ID: ${payment._id}`);
            console.log(`   Status: ${payment.status}`);
            console.log(`   Amount: KSH ${payment.amount}`);
            console.log(`   Phone: ${payment.phone}`);
            console.log(`   CheckoutID: ${payment.checkoutId}`);
            console.log(`   Created: ${payment.createdAt}`);
        } else {
            console.log('❌ No payment record found');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ STK PUSH TEST COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60));
        console.log(`\n📱 Check your phone (0715255115) for the payment prompt!`);
        console.log(`\n🔍 Reference data:
   - Booking ID: ${testBooking._id}
   - Payment ID: ${payment?._id}
   - Checkout ID: ${payment?.checkoutId}
   - Room: ${testRoom.name} (KSH ${testRoom.price})
        `);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.response?.data) {
            console.error('API Response:', error.response.data);
        }
        process.exit(1);
    }
};

testSTKPush();
