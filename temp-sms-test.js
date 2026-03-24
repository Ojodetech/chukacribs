const sms = require('./config/sms');
const axios = require('axios');
axios.post = async () => { throw new Error('Network failure'); };
process.env.SMS_ENABLED = 'true';
process.env.SMS_PROVIDER = 'africastalking';
process.env.AFRICASTALKING_USERNAME = 'x';
process.env.AFRICASTALKING_API_KEY = 'y';

(async () => {
  const out = await sms.sendSMS('0712345678', 'test');
  console.log('out', out);
})();
