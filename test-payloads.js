require('dotenv').config({ path: '.env.production' });
const axios = require('axios');

const apiKey = process.env.SENDER_API_KEY;

// Test different payload formats for /v2/campaigns endpoint
const payloadFormats = [
  {
    name: 'Format 1: from as string (email only)',
    payload: {
      from: 'no-reply@chukacribs.co.ke',
      to: [{ email: 'test@example.com' }],
      subject: 'Test',
      html: '<p>Test</p>'
    }
  },
  {
    name: 'Format 2: from as string with name',
    payload: {
      from: 'no-reply@chukacribs.co.ke',
      fromName: 'ChukaCribs',
      to: [{ email: 'test@example.com' }],
      subject: 'Test',
      html: '<p>Test</p>'
    }
  },
  {
    name: 'Format 3: recipients instead of to',
    payload: {
      from: 'no-reply@chukacribs.co.ke',
      recipients: [{ email: 'test@example.com' }],
      subject: 'Test',
      html: '<p>Test</p>'
    }
  },
  {
    name: 'Format 4: to as array of strings',
    payload: {
      from: 'no-reply@chukacribs.co.ke',
      to: ['test@example.com'],
      subject: 'Test',
      html: '<p>Test</p>'
    }
  }
];

async function testPayloadFormats() {
  console.log('📋 Testing Sender API v2/campaigns Payload Formats...\n');
  console.log('Endpoint: https://api.sender.net/v2/campaigns\n');

  for (const test of payloadFormats) {
    console.log(`\nTesting: ${test.name}`);
    console.log('━'.repeat(70));

    try {
      const response = await axios.post(
        'https://api.sender.net/v2/campaigns',
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
        console.log('✅ SUCCESS! This payload format works!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
      } else if (response.status === 422) {
        console.log('⚡ 422 Validation Error - Payload structure issue:');
        if (response.data?.errors) {
          console.log('Errors:', response.data.errors);
        } else {
          console.log(JSON.stringify(response.data, null, 2));
        }
      } else {
        console.log(`Response: ${JSON.stringify(response.data).substring(0, 120)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log(`\n${  '='.repeat(70)}`);
}

testPayloadFormats();
