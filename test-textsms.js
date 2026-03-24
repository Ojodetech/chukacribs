// Load environment variables
require('dotenv').config();

const smsService = require('./config/sms');

// Test TextSMS functionality
async function testTextSMS() {
  try {
    console.log('Testing TextSMS service...');

    // Test phone number (replace with your actual number for testing)
    const testPhone = '0715255115'; // Your test number
    const testMessage = 'ChukaCribs SMS Test - TextSMS Provider';

    console.log(`Sending SMS to: ${testPhone}`);
    console.log(`Message: ${testMessage}`);

    const result = await smsService.sendSMS(testPhone, testMessage);

    console.log('✅ SMS sent successfully!');
    console.log('Response:', result);

  } catch (error) {
    console.error('❌ SMS test failed:');
    console.error('Error:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testTextSMS();