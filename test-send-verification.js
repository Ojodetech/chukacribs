require('dotenv').config({ path: '.env.production' });
const { sendEmail } = require('./config/email');
const crypto = require('crypto');

(async () => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontend.replace(/\/$/, '')}/verify-email?token=${token}&email=ojodewycliffe0%40gmail.com`;

    const subject = '🔐 Verify your ChukaCribs email';
    const html = `<p>Hi,</p><p>Click the link below to verify your email for ChukaCribs:</p><p><a href="${verifyUrl}">Verify my email</a></p><p>If you did not request this, you can ignore this message.</p>`;
    const text = `Verify your email: ${verifyUrl}`;

    console.log('Sending verification email to ojodewycliffe0@gmail.com...');
    const res = await sendEmail({ to: 'ojodewycliffe0@gmail.com', subject, html, text });
    console.log('Send result:', res);
  } catch (err) {
    console.error('Failed to send verification email:', err.message || err);
    if (err.response) {console.error('Response data:', err.response.data);}
    process.exitCode = 1;
  }
})();
