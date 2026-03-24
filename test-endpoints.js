require('dotenv').config({ path: '.env.production' });
const axios = require('axios');

const apiKey = process.env.SENDER_API_KEY;
const baseUrl = 'https://api.sender.net';

const endpoints = [
  { method: 'POST', path: '/v4/emails/send' },
  { method: 'POST', path: '/v4/email/send' },
  { method: 'POST', path: '/v4/emails' },
  { method: 'POST', path: '/v2/emails' },
  { method: 'POST', path: '/v2/transactional/emails' },
  { method: 'POST', path: '/v3/emails' },
];

const testPayload = {
  from: { email: 'test@example.com', name: 'Test' },
  to: [{ email: 'test@example.com' }],
  subject: 'Test',
  html: '<p>Test</p>'
};

async function testEndpoints() {
  console.log('🧪 Testing Sender API Endpoints...\n');
  console.log('API Base URL:', baseUrl);
  console.log('API Key: Set ✅\n');

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint.path}`;
    console.log(`\n${endpoint.method} ${url}`);
    console.log('━'.repeat(70));

    try {
      const response = await axios({
        method: endpoint.method,
        url,
        data: testPayload,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 5000,
        validateStatus: () => true // Don't throw
      });

      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 405) {
        console.log('⚠️  Method not allowed - endpoint exists but doesn\'t support POST');
      } else if (response.status === 404) {
        console.log('❌ Endpoint not found');
      } else if (response.status === 401) {
        console.log('🔐 Authentication failed');
      } else if (response.status >= 200 && response.status < 300) {
        console.log('✅ Success!');
        console.log('Response:', JSON.stringify(response.data).substring(0, 100));
      } else {
        console.log('Response:', JSON.stringify(response.data).substring(0, 100));
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log(`\n${  '='.repeat(70)}`);
  console.log('Test complete. Check which endpoint responds successfully.');
}

testEndpoints();
