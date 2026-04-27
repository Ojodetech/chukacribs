require('dotenv').config();
const mongoose = require('mongoose');
const CoreBooking = require('./models/CoreBooking');

const checkBooking = async () => {
    try {
        console.log('🔍 Checking booking existence...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected\n');

        const bookingId = '69ef0af055109c9a33f9c245';
        console.log(`Searching for booking: ${bookingId}`);

        const booking = await CoreBooking.findById(bookingId).populate('room').populate('user');

        if (booking) {
            console.log('\n✅ BOOKING FOUND!\n');
            console.log('=' .repeat(70));
            console.log('Booking Details:');
            console.log('=' .repeat(70));
            console.log(`Booking ID:   ${booking._id}`);
            console.log(`Status:       ${booking.status}`);
            console.log(`User:         ${booking.user?.name} (${booking.user?.phone})`);
            console.log(`Room:         ${booking.room?.name} - KSH ${booking.room?.price}`);
            console.log(`Created:      ${booking.createdAt}`);
            console.log('=' .repeat(70) + '\n');
        } else {
            console.log('\n❌ BOOKING NOT FOUND\n');
            console.log('Available bookings:');
            const allBookings = await CoreBooking.find().limit(5);
            allBookings.forEach((b, i) => {
                console.log(`  ${i + 1}. ${b._id} - Status: ${b.status}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

checkBooking();
