require('dotenv').config({ path: '.env.production' });
const axios = require('axios');

const apiKey = process.env.SENDER_API_KEY;

// Test with different authentication methods
const authMethods = [
  { 
    name: 'Bearer Token in Authorization header',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  },
  {
    name: 'Token in Authorization header (no Bearer)',
    headers: { 'Authorization': apiKey }
  },
  {
    name: 'X-Sender-Token header',
    headers: { 'X-Sender-Token': apiKey }
  },
  {
    name: 'X-API-Key header',
    headers: { 'X-API-Key': apiKey }
  }
];

const testPayload = {
  from: { email: 'test@example.com', name: 'Test' },
  to: [{ email: 'test@example.com' }],
  subject: 'Test',
  html: '<p>Test</p>'
};

async function testAuthMethods() {
  console.log('🔐 Testing Different Authentication Methods...\n');
  console.log('Endpoint: https://api.sender.net/v4/emails/send\n');

  for (const auth of authMethods) {
    console.log(`\nTesting: ${auth.name}`);
    console.log('━'.repeat(70));

    try {
      const response = await axios.post(
        'https://api.sender.net/v4/emails/send',
        testPayload,
        {
          headers: {
            ...auth.headers,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 5000,
          validateStatus: () => true
        }
      );

      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 405) {
        console.log('⚠️  405 Method Not Allowed');
      } else if (response.status === 401) {
        console.log('🔐 401 Unauthorized - Auth failed');
      } else if (response.status === 403) {
        console.log('🚫 403 Forbidden - Auth issue');
      } else if (response.status >= 200 && response.status < 300) {
        console.log('✅ Success!');
      } else {
        console.log(`Response: ${JSON.stringify(response.data).substring(0, 80)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log(`\n${  '='.repeat(70)}`);
}

testAuthMethods();
