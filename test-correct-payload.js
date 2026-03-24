const axios = require('axios');
require('dotenv').config({ path: '.env.production' });

const payload = {
  from: { email: 'no-reply@chukacribs.co.ke', name: 'ChukaCribs' },
  to: { email: 'ojodewycliffe0@gmail.com', name: 'Test User' },
  subject: '🔐 Verify Your Email - ChukaCribs',
  html: '<p>Test email</p>',
  text: 'Test email'
};

console.log('Sending with payload:');
console.log(JSON.stringify(payload, null, 2));

axios.post('https://api.sender.net/v2/message/send', payload, {
  headers: {
    'Authorization': `Bearer ${process.env.SENDER_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000,
  validateStatus: () => true
}).then(r => {
  console.log('\nStatus:', r.status, r.statusText);
  console.log('Response:', JSON.stringify(r.data, null, 2));
}).catch(e => console.error('Error:', e.message));
