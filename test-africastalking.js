/**
 * Test Africa's Talking SMS Service
 * Tests the SMS functionality with Africa's Talking API
 */

require('dotenv').config({ path: '.env.production' });

const axios = require('axios');

// Test configuration
const AFRICASTALKING_USERNAME = process.env.AFRICASTALKING_USERNAME;
const AFRICASTALKING_API_KEY = process.env.AFRICASTALKING_API_KEY;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || 'CHUKACRIBS';
const SMS_ENABLED = process.env.SMS_ENABLED === 'true';

console.log('🧪 Testing Africa\'s Talking SMS Service\n');
console.log('📋 Configuration:');
console.log(`   Username: ${AFRICASTALKING_USERNAME}`);
console.log(`   API Key: ${AFRICASTALKING_API_KEY ? '✅ Configured' : '❌ Missing'}`);
console.log(`   Sender ID: ${SMS_SENDER_ID}`);
console.log(`   SMS Enabled: ${SMS_ENABLED ? '✅ Yes' : '❌ No'}\n`);

if (!AFRICASTALKING_USERNAME || !AFRICASTALKING_API_KEY) {
  console.error('❌ ERROR: Africa\'s Talking credentials not configured');
  console.log('   Set AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY in .env.production');
  process.exit(1);
}

if (!SMS_ENABLED) {
  console.error('❌ ERROR: SMS is disabled (SMS_ENABLED=false)');
  process.exit(1);
}

/**
 * Format phone number for Africa's Talking
 */
const formatPhoneNumber = (phoneNumber) => {
  let formatted = phoneNumber.replace(/^\+/, ''); // Remove + if present
  if (formatted.startsWith('0')) {
    formatted = `+254${formatted.substring(1)}`; // Replace 0 with +254
  } else if (!formatted.startsWith('254')) {
    formatted = `+254${formatted}`; // Add country code
  } else {
    formatted = `+${formatted}`; // Add + if missing
  }
  return formatted;
};

/**
 * Send test SMS
 */
const sendTestSMS = async (phoneNumber, message) => {
  try {
    console.log(`📱 Sending SMS to ${phoneNumber}...`);
    console.log(`   Message: "${message}"\n`);

    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log(`   Formatted number: ${formattedPhone}`);

    const response = await axios.post(
      'https://api.africastalking.com/version1/messaging',
      new URLSearchParams({
        username: AFRICASTALKING_USERNAME,
        to: formattedPhone,
        message: message,
        from: SMS_SENDER_ID
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'apiKey': AFRICASTALKING_API_KEY
        }
      }
    );

    console.log('\n✅ SMS Sent Successfully!');
    console.log('📊 Response Details:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));

    if (response.data?.SMSMessageData?.Recipients?.[0]) {
      const recipient = response.data.SMSMessageData.Recipients[0];
      console.log('\n📱 Recipient Details:');
      console.log(`   Number: ${recipient.number}`);
      console.log(`   Status: ${recipient.status}`);
      console.log(`   Message ID: ${recipient.messageId}`);
      console.log(`   Cost: ${recipient.cost}`);
    }

    return { success: true, data: response.data };

  } catch (error) {
    console.error('\n❌ SMS Failed!');
    console.error('📊 Error Details:');
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Message: ${error.message}`);
    if (error.response?.data) {
      console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
    }

    return { success: false, error: error.message };
  }
};

/**
 * Main test function
 */
const runTests = async () => {
  console.log('🔄 Testing Phone Number Formatting:\n');

  const testNumbers = [
    '+254712345678',
    '254712345678',
    '0712345678',
    '712345678'
  ];

  testNumbers.forEach(number => {
    const formatted = formatPhoneNumber(number);
    console.log(`   ${number} → ${formatted}`);
  });

  console.log('\n' + '='.repeat(50));

  // Test SMS to the provided number
  const testPhone = '0715255115';
  const testMessage = 'Hello from ChukaCribs! This is a test SMS from your Africa\'s Talking integration. 🏠📱';

  console.log(`\n🚀 Sending Test SMS to ${testPhone}`);
  const result = await sendTestSMS(testPhone, testMessage);

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test Complete');

  if (result.success) {
    console.log('✅ SMS sent successfully! Check your phone.');
  } else {
    console.log('❌ SMS failed. Check the error details above.');
  }
};

// Run the tests
runTests().catch(console.error);