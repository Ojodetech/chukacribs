require('dotenv').config({ path: '.env.production' });
const axios = require('axios');

const apiKey = process.env.SENDER_API_KEY;

// Test complete payload structure
const payloads = [
  {
    name: 'Format 1: from & to as objects {address}',
    payload: {
      from: { address: 'no-reply@chukacribs.co.ke' },
      to: { address: 'ojodewycliffe0@gmail.com' },
      subject: 'Test Email',
      html: '<p>Test</p>'
    }
  },
  {
    name: 'Format 2: from & to with {name, address}',
    payload: {
      from: { name: 'ChukaCribs', address: 'no-reply@chukacribs.co.ke' },
      to: { name: 'Test User', address: 'ojodewycliffe0@gmail.com' },
      subject: 'Test Email',
      html: '<p>Test</p>'
    }
  },
  {
    name: 'Format 3: With content_type',
    payload: {
      from: { name: 'ChukaCribs', address: 'no-reply@chukacribs.co.ke' },
      to: { name: 'Test User', address: 'ojodewycliffe0@gmail.com' },
      subject: 'Test Email',
      html: '<p>Test</p>',
      content_type: 'html'
    }
  },
  {
    name: 'Format 4: Full structure',
    payload: {
      from: { name: 'ChukaCribs', address: 'no-reply@chukacribs.co.ke' },
      to: { name: 'Test User', address: 'ojodewycliffe0@gmail.com' },
      reply_to: { address: 'no-reply@chukacribs.co.ke' },
      subject: '🔐 Verify Your Email - ChukaCribs',
      html: '<p>Click to verify</p>',
      text: 'Click to verify',
      content_type: 'html'
    }
  }
];

async function testPayloads() {
  console.log('📋 Testing Sender API /message/send Complete Payload...\n');
  console.log('Endpoint: https://api.sender.net/v2/message/send\n');

  for (const test of payloads) {
    console.log(`\n${test.name}`);
    console.log('━'.repeat(70));

    try {
      const response = await axios.post(
        'https://api.sender.net/v2/message/send',
        test.payload,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 5000,
          validateStatus: () => true
        }
      );

      console.log(`Status: ${response.status} ${response.statusText}`);

      if (response.status >= 200 && response.status < 300) {
        console.log('✅ SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
      } else if (response.status === 422) {
        console.log('⚡ 422 Validation Error:');
        if (response.data?.errors) {
          console.log(JSON.stringify(response.data.errors, null, 2));
        } else if (response.data?.message) {
          console.log('Message:', response.data.message);
        }
      } else {
        console.log(`Response:`, response.data);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log(`\n${  '='.repeat(70)}`);
}

testPayloads();
