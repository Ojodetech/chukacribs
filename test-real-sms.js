require('dotenv').config();
const sms = require('./config/sms.js');

async function testRealSMS() {
  // Replace with your actual phone number
  const yourPhoneNumber = process.argv[2] || '0715255115'; // Pass as command line argument

  if (!yourPhoneNumber || yourPhoneNumber === '0715255115') {
    console.log('❌ Please provide your real phone number!');
    console.log('');
    console.log('Usage: node test-real-sms.js +254712345678');
    console.log('Or:    node test-real-sms.js 0712345678');
    console.log('');
    console.log('⚠️  WARNING: This will send a real SMS to the provided number!');
    console.log('💰 Cost: ~0.5-1 KSH per SMS');
    return;
  }

  console.log('📱 Testing SMS with real phone number...');
  console.log('Phone:', yourPhoneNumber);
  console.log('⚠️  This will send an actual SMS - you may be charged!');
  console.log('');

  try {
    const result = await sms.sendSMS(yourPhoneNumber, 'ChukaCribs: SMS integration test - Real number verification');

    console.log('📤 SMS Response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ SUCCESS: SMS sent to real number!');
      console.log('📨 Message ID:', result.messageId);
    } else {
      console.log('❌ FAILED: SMS not sent');
      console.log('🔍 Reason:', result.response?.SMSMessageData?.Message || 'Unknown error');

      // Check if it's blacklist or other error
      if (result.response?.SMSMessageData?.Recipients?.[0]?.status === 'UserInBlacklist') {
        console.log('🚫 This number is also blacklisted (rare for real numbers)');
      }
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testRealSMS();