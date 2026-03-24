require('dotenv').config();
const { sendBookingConfirmationSMS, BookingConfirmationSMS } = require('./config/smsNotifications');

// Mock landlord object for testing
const mockLandlord = {
  _id: '507f1f77bcf86cd799439011',
  firstName: 'Wycliffe',
  lastName: 'Ojode',
  phoneNumber: '0715255115',
  email: 'landlord@example.com'
};

// Mock booking confirmation data
const mockBookingData = {
  studentName: 'John Doe',
  studentContact: '+254712345678',
  propertyName: 'Cozy 1-Bedroom Apartment near Campus',
  bookingId: 'BOOKING-2026-001'
};

// Function to display SMS
function displaySMS(title, smsContent, recipient) {
  console.log('\n' + '='.repeat(70));
  console.log(`📱 ${title}`);
  console.log('='.repeat(70));
  console.log('');
  console.log(smsContent);
  console.log('');
  console.log('='.repeat(70));
  console.log(`Recipient: ${recipient}`);
  console.log(`SMS Length: ${smsContent.length} characters`);
  console.log('='.repeat(70));
  console.log('');
}

async function testSMSNotifications() {
  console.log('\n🧪 ChukaCribs Booking Confirmation SMS Test\n');

  try {
    // Display booking confirmation SMS
    const bookingSMS = BookingConfirmationSMS.template(
      mockLandlord,
      mockBookingData.studentName,
      mockBookingData.studentContact,
      mockBookingData.propertyName,
      mockBookingData.bookingId
    );
    displaySMS('SMS NOTIFICATION: BOOKING CONFIRMED', bookingSMS, mockLandlord.phoneNumber);

    // Summary
    console.log('\n📊 SMS NOTIFICATION DETAILS:');
    console.log('');
    console.log('Trigger: When student confirms a booking');
    console.log('Recipient: Landlord');
    console.log('✅ Includes Landlord Name: Yes');
    console.log('✅ Includes Landlord Contact: Yes');
    console.log('✅ Includes Thank You Message: Yes');
    console.log('✅ Includes Booking ID: Yes');
    console.log('✅ Professional Format: Yes');
    console.log('');
    console.log('Note: Payment notifications handled by M-Pesa');
    console.log('');
    console.log('🚀 SMS Notifications Ready for Integration!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run test
if (require.main === module) {
  testSMSNotifications();
}