#!/usr/bin/env node
const axios = require('axios');
require('dotenv').config({ path: '.env.production' });

const OPENSMS_API_USERNAME = process.env.OPENSMS_API_USERNAME;
const OPENSMS_API_PASSWORD = process.env.OPENSMS_API_PASSWORD;
const OPENSMS_API_URL = process.env.OPENSMS_API_URL || 'https://www.opensms.co.ke/api/http/';
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || 'OPENSMS';

console.log('🔍 Testing OpenSMS Credentials...\n');
console.log('Configuration:');
console.log(`- API URL: ${OPENSMS_API_URL}`);
console.log(`- Username: ${OPENSMS_API_USERNAME}`);
console.log(`- Sender ID: ${SMS_SENDER_ID}`);
console.log(`- Password: ${OPENSMS_API_PASSWORD ? '✅ Configured' : '❌ Missing'}\n`);

if (!OPENSMS_API_USERNAME || !OPENSMS_API_PASSWORD) {
  console.error('❌ ERROR: Missing credentials');
  process.exit(1);
}

const testSMS = async () => {
  try {
    console.log('📤 Testing OpenSMS API connection...\n');
    
    // OpenSMS HTTP API format - using basic auth
    const response = await axios.post(
      `${OPENSMS_API_URL}sms/send`,
      {
        recipient: '+254712345678', // Test number
        message: 'Test SMS from ChukaCribs',
        sender: SMS_SENDER_ID
      },
      {
        auth: {
          username: OPENSMS_API_USERNAME,
          password: OPENSMS_API_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ API Connection Successful!\n');
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('\n✅ CREDENTIALS ARE VALID AND WORKING! ✅');
      console.log('\nThe OpenSMS integration is ready to go!');
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response?.data) {
      console.error('\nError Response:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('\n❌ AUTHENTICATION FAILED - Invalid credentials');
      console.error('Please verify your API username and password are correct');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ Cannot connect to OpenSMS API - check internet connection');
    } else if (error.response?.status === 400) {
      console.error('\n⚠️  Credentials valid but invalid SMS format (expected for test)');
      console.log('✅ Credentials are WORKING!');
    }
    process.exit(1);
  }
};

testSMS();
