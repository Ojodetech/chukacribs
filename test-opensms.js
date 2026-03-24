/**
 * Test OpenSMS Service
 * Tests the SMS functionality with OpenSMS API endpoints
 */

require('dotenv').config({ path: '.env.production' });

const axios = require('axios');

// Test configuration
const OPENSMS_API_TOKEN = process.env.OPENSMS_API_TOKEN;
const OPENSMS_HTTP_URL = process.env.OPENSMS_API_URL || 'https://www.opensms.co.ke/api/http/';
const OPENSMS_OAUTH_URL = process.env.OPENSMS_OAUTH_URL || 'https://www.opensms.co.ke/api/v3/';
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || 'OPENSMS';

console.log('🧪 Testing OpenSMS Service\n');
console.log('📋 Configuration:');
console.log(`   HTTP API URL: ${OPENSMS_HTTP_URL}`);
console.log(`   OAuth API URL: ${OPENSMS_OAUTH_URL}`);
console.log(`   Sender ID: ${SMS_SENDER_ID}`);
console.log(`   API Token: ${OPENSMS_API_TOKEN ? '✅ Configured' : '❌ Missing'}\n`);

if (!OPENSMS_API_TOKEN) {
  console.error('❌ ERROR: OPENSMS_API_TOKEN is not set in environment variables');
  process.exit(1);
}

/**
 * Test phone number formatting
 */
const testPhoneFormatting = () => {
  console.log('🔄 Testing Phone Number Formatting:\n');

  const testNumbers = [
    '+254712345678',
    '254712345678',
    '0712345678',
    '712345678'
  ];

  testNumbers.forEach(number => {
    let formatted = number.replace(/^\+/, '');
    if (formatted.startsWith('0')) {
      formatted = `254${  formatted.substring(1)}`;
    } else if (!formatted.startsWith('254')) {
      formatted = `254${  formatted}`;
    }
    console.log(`   ${number} → ${formatted}`);
  });
};

/**
 * Test OpenSMS HTTP API endpoint
 */
const testHTTPAPI = async () => {
  console.log('\n📡 Testing HTTP API Endpoint\n');
  
  try {
    const testPhoneNumber = '254712345678';
    const testMessage = `🧪 ChukaCribs SMS Test - ${new Date().toISOString()}`;

    console.log('📱 Sending Test SMS via HTTP API...');
    console.log(`   To: ${testPhoneNumber}`);
    console.log(`   Message: "${testMessage}"`);
    console.log(`   Endpoint: ${OPENSMS_HTTP_URL}\n`);

    // Try GET request with query parameters
    const response = await axios.get(
      OPENSMS_HTTP_URL,
      {
        params: {
          apikey: OPENSMS_API_TOKEN,
          to: testPhoneNumber,
          message: testMessage,
          sender: SMS_SENDER_ID
        },
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    console.log('✅ HTTP API Request Successful!\n');
    console.log('📤 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data?.success) {
      console.log('\n✅ Status: SUCCESS');
      console.log(`   Message ID: ${response.data?.data?.message_id || 'N/A'}`);
    }

  } catch (error) {
    console.error('❌ HTTP API Request Failed!\n');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('\n📤 API Response:');
      console.error(JSON.stringify(error.response.data, null, 2));
      console.error(`Status Code: ${error.response.status}`);
    }
  }
};

/**
 * Test OpenSMS OAuth API endpoint
 */
const testOAuthAPI = async () => {
  console.log('\n📡 Testing OAuth API Endpoint\n');
  
  try {
    const testPhoneNumber = '254712345678';
    const testMessage = `🧪 ChukaCribs SMS Test - ${new Date().toISOString()}`;

    console.log('📱 Sending Test SMS via OAuth API...');
    console.log(`   To: ${testPhoneNumber}`);
    console.log(`   Message: "${testMessage}"`);
    console.log(`   Endpoint: ${OPENSMS_OAUTH_URL}sms/send\n`);

    const response = await axios.post(
      `${OPENSMS_OAUTH_URL  }sms/send`,
      {
        phone_number: testPhoneNumber,
        message: testMessage,
        sender_id: SMS_SENDER_ID
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENSMS_API_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ OAuth API Request Successful!\n');
    console.log('📤 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data?.success || response.status === 200) {
      console.log('\n✅ Status: SUCCESS');
      console.log(`   Message ID: ${response.data?.data?.message_id || 'N/A'}`);
    }

  } catch (error) {
    console.error('❌ OAuth API Request Failed!\n');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('\n📤 API Response:');
      console.error(JSON.stringify(error.response.data, null, 2));
      console.error(`Status Code: ${error.response.status}`);
    }
  }
};

/**
 * Run all tests
 */
const runTests = async () => {
  testPhoneFormatting();
  console.log(`\n${  '='.repeat(60)}`);
  
  await testHTTPAPI();
  console.log(`\n${  '='.repeat(60)}`);
  
  await testOAuthAPI();
  console.log(`\n${  '='.repeat(60)}`);
  
  console.log('\n✅ Test completed\n');
};

runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
