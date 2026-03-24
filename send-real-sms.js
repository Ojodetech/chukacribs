#!/usr/bin/env node
const axios = require('axios');
require('dotenv').config({ path: '.env.production' });

const OPENSMS_API_PASSWORD = process.env.OPENSMS_API_PASSWORD;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || 'OPENSMS';

const sendRealSMS = async () => {
  try {
    console.log('📤 Sending SMS to 0715255115...\n');

    // Format phone number
    let phoneNumber = '0715255115';
    if (phoneNumber.startsWith('0')) {
      phoneNumber = `254${  phoneNumber.substring(1)}`; // Convert 0715255115 to 254715255115
    }

    console.log(`Phone Number (formatted): ${phoneNumber}`);
    console.log(`Sender ID: ${SMS_SENDER_ID}\n`);

    // Use the CORRECT v3 API endpoint with proper format
    const response = await axios.post(
      'https://opensms.co.ke/api/v3/sms/send',
      {
        recipient: phoneNumber,
        sender_id: SMS_SENDER_ID,
        type: 'plain',
        message: 'ChukaCribs: SMS integration test successful! Your OpenSMS credentials are working perfectly.'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENSMS_API_PASSWORD}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ SMS Sent Successfully!\n');
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data?.status === 'success') {
      console.log('\n✅✅✅ MESSAGE DELIVERED! Check your phone for the SMS! ✅✅✅');
    }
  } catch (error) {
    console.error('❌ ERROR Sending SMS:', error.message);
    if (error.response?.data) {
      console.error('\nError Response:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status === 401) {
      console.error('\n❌ Authentication failed');
    }
    process.exit(1);
  }
};

sendRealSMS();
