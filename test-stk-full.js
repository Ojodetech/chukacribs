require('dotenv').config();

// ENFORCE PRODUCTION MODE
process.env.NODE_ENV = 'production';
process.env.USE_MOCK_MPESA = 'false';

const axios = require('axios');
const mongoose = require('mongoose');

const testPaymentFlow = async () => {
    try {
        console.log('🚀 COMPLETE STK PUSH FLOW TEST\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chuka-cribs');
        console.log('✅ MongoDB Connected\n');

        const User = require('./models/User');
        const Room = require('./models/Room');
        const CoreBooking = require('./models/CoreBooking');
        const CorePayment = require('./models/CorePayment');

        // Create fresh test data
        console.log('📝 STEP 1: Creating test data...\n');
        
        const user = await User.create({
            name: 'John Doe STK Test',
            phone: '0715255115',
            email: 'stk-test-' + Date.now() + '@chukacribs.com'
        }).catch(async (err) => {
            if (err.code === 11000) {
                // Delete old records and recreate
                await User.deleteMany({ phone: '0715255115' });
                return User.create({
                    name: 'John Doe STK Test',
                    phone: '0715255115',
                    email: 'stk-test-' + Date.now() + '@chukacribs.com'
                });
            }
            throw err;
        });
        console.log(`✅ User created: ${user._id}`);

        const room = await Room.create({
            name: 'Luxury Bedsitter ' + Date.now(),
            price: 4000,
            description: 'Premium furnished bedsitter',
            amenities: ['WiFi', 'Hot Water', 'Kitchen']
        });
        console.log(`✅ Room created: ${room._id} (KSH ${room.price})\n`);

        const booking = await CoreBooking.create({
            user: user._id,
            room: room._id,
            status: 'PENDING'
        });
        console.log(`✅ Booking created: ${booking._id}`);
        console.log(`   Status: PENDING\n`);

        // Test the payment initiation
        console.log('='.repeat(70));
        console.log('💳 STEP 2: Testing Payment Initiation\n');

        const { initiateSTKPush } = require('./config/mpesa');
        
        console.log('Calling initiateSTKPush with:');
        console.log(`  Phone: 0715255115`);
        console.log(`  Amount: KSH ${room.price}`);
        console.log(`  OrderID: ${booking._id}\n`);

        const stkResponse = await initiateSTKPush('0715255115', room.price, booking._id.toString());

        console.log('✅ STK Push Response:');
        console.log(JSON.stringify(stkResponse, null, 2));

        // Now create payment record (simulating what the endpoint does)
        console.log('\n' + '='.repeat(70));
        console.log('💾 STEP 3: Storing Payment Record\n');

        const checkoutId = stkResponse.checkoutRequestId;
        
        const payment = await CorePayment.create({
            booking: booking._id,
            phone: '0715255115',
            amount: room.price,
            checkoutId: checkoutId,
            status: 'PENDING'
        });

        console.log('✅ Payment record created:');
        console.log(`   ID: ${payment._id}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Amount: KSH ${payment.amount}`);
        console.log(`   CheckoutID: ${payment.checkoutId}`);
        console.log(`   Phone: ${payment.phone}\n`);

        // Show what happens next
        console.log('='.repeat(70));
        console.log('📱 STEP 4: What Happens Next\n');
        console.log('1. ✅ STK Push sent to 0715255115');
        console.log('2. ⏳ User enters M-Pesa PIN (or cancels)');
        console.log('3. 🔔 M-Pesa calls POST /api/core/mpesa/callback with result');
        console.log('4. 🔥 System automatically:');
        console.log(`     - Updates Payment status to SUCCESS/FAILED`);
        console.log(`     - Updates Booking status to PAID (if success)`);
        console.log(`     - LOCKS room (isOccupied = true)`);
        console.log(`     - Triggers SMS, email, admin notifications\n`);

        console.log('='.repeat(70));
        console.log('✅ TEST COMPLETE - STK PUSH SUCCESSFUL');
        console.log('='.repeat(70));
        
        console.log('\n📊 SUMMARY:');
        console.log(`   Booking ID:      ${booking._id}`);
        console.log(`   Payment ID:      ${payment._id}`);
        console.log(`   Checkout ID:     ${checkoutId}`);
        console.log(`   Amount:          KSH ${room.price}`);
        console.log(`   Phone:           0715255115`);
        console.log(`   User:            ${user.name}`);
        console.log(`   Room:            ${room.name}`);
        console.log(`\n💡 In production mode, M-Pesa will really send the prompt!`);
        console.log(`   USE_MOCK_MPESA=false in .env to use real M-Pesa.`);

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

testPaymentFlow();
