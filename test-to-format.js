require('dotenv').config({ path: '.env.production' });
const axios = require('axios');

const apiKey = process.env.SENDER_API_KEY;

// Test different "to" field formats
const payloadFormats = [
  {
    name: 'Format 1: to as string (email only)',
    payload: {
      from: 'no-reply@chukacribs.co.ke',
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>'
    }
  },
  {
    name: 'Format 2: to as object {address}',
    payload: {
      from: 'no-reply@chukacribs.co.ke',
      to: { address: 'test@example.com' },
      subject: 'Test',
      html: '<p>Test</p>'
    }
  },
  {
    name: 'Format 3: to as object {name, address}',
    payload: {
      from: 'no-reply@chukacribs.co.ke',
      to: { name: 'Test User', address: 'test@example.com' },
      subject: 'Test',
      html: '<p>Test</p>'
    }
  },
  {
    name: 'Format 4: to as object {email, name}',
    payload: {
      from: 'no-reply@chukacribs.co.ke',
      to: { email: 'test@example.com', name: 'Test User' },
      subject: 'Test',
      html: '<p>Test</p>'
    }
  }
];

async function testToFormats() {
  console.log('📋 Testing Sender API /message/send "to" Field Formats...\n');
  console.log('Endpoint: https://api.sender.net/v2/message/send\n');

  for (const test of payloadFormats) {
    console.log(`\nTesting: ${test.name}`);
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
        console.log('✅ SUCCESS! Email sent!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
      } else if (response.status === 422) {
        console.log('⚡ 422 Validation Error:');
        if (response.data?.errors) {
          console.log('Errors:', JSON.stringify(response.data.errors, null, 2));
        } else if (response.data?.message) {
          console.log('Message:', response.data.message);
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

testToFormats();
