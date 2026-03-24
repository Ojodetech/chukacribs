require('dotenv').config({ path: '.env.production' });
const axios = require('axios');

const apiKey = process.env.SENDER_API_KEY;
const baseUrl = 'https://api.sender.net/v2';

// Possible email-related endpoints based on common REST patterns
const possibleEndpoints = [
  '/emails',
  '/transactional/emails',
  '/mail/send',
  '/send',
  '/messages',
  '/message',
  '/campaigns',
  '/transactional',
  '/'
];

const testPayload = {
  from: { email: 'test@example.com', name: 'Test' },
  to: [{ email: 'test@example.com' }],
  subject: 'Test',
  html: '<p>Test</p>'
};

async function discoverEndpoints() {
  console.log('🔍 Discovering Sender API v2 Endpoints...\n');
  console.log('Base URL:', baseUrl);
  console.log('Testing common email/send endpoints:\n');

  for (const endpoint of possibleEndpoints) {
    const url = `${baseUrl}${endpoint}`;
    console.log(`POST ${url}`);

    try {
      const response = await axios.post(
        url,
        testPayload,
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

      if (response.status === 404) {
        console.log(`  ❌ 404 - Route not found: ${response.data?.message || 'Unknown'}`);
      } else if (response.status === 401) {
        console.log(`  🔐 401 - Unauthorized: ${response.data?.message || 'Check API key'}`);
      } else if (response.status === 405) {
        console.log(`  ⚠️  405 - Method not allowed`);
      } else if (response.status === 422 || response.status === 400) {
        console.log(`  ⚡ ${response.status} - Invalid request (endpoint exists!): ${response.data?.message || 'Check payload'}`);
      } else if (response.status >= 200 && response.status < 300) {
        console.log(`  ✅ ${response.status} - SUCCESS! This is the endpoint to use.`);
        console.log(`     Response: ${JSON.stringify(response.data).substring(0, 100)}`);
      } else {
        console.log(`  ℹ️  ${response.status} - ${response.statusText}: ${response.data?.message || JSON.stringify(response.data).substring(0, 80)}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n${  '='.repeat(70)}`);
  console.log('Discovery complete. Look for 400/422 or 200 status codes.');
  console.log('These indicate the endpoint exists but needs valid data.');
}

discoverEndpoints();
