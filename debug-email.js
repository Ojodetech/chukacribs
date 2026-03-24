const dotenv = require('dotenv');
const path = require('path');

// Load .env.production
dotenv.config({ path: path.join(__dirname, '.env.production') });

console.log('🔍 Gmail Authentication Debug\n');
console.log('Configuration:');
console.log(`  EMAIL_USER: ${process.env.EMAIL_USER}`);
console.log(`  EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD}`);
console.log(`  EMAIL_PASSWORD length: ${process.env.EMAIL_PASSWORD?.length || 0} characters`);
console.log(`  EMAIL_HOST: ${process.env.EMAIL_HOST}`);
console.log(`  EMAIL_PORT: ${process.env.EMAIL_PORT}`);

console.log('\n⚠️  Gmail Authentication Error (535-5.7.8)');
console.log('This error typically means:');
console.log('  1. The app password is incorrect');
console.log('  2. The email account doesn\'t have 2-factor authentication enabled');
console.log('  3. The app password format is wrong\n');

console.log('Common Solutions:');
console.log('  ✓ Ensure 2-Factor Authentication is enabled on your Gmail account');
console.log('  ✓ Generate a new app password from Google Account settings');
console.log('  ✓ Remove all spaces from the app password');
console.log('  ✓ App password should be 16 characters without spaces');
console.log('  ✓ Copy-paste directly from Google, don\'t manually type it\n');

console.log('📝 Please verify your app password format:');
console.log('  - Gmail app passwords are typically 16 characters');
console.log('  - Format: xxxx xxxx xxxx xxxx (with 4 groups of 4)');
console.log('  - When storing in .env, remove all spaces: xxxxxxxxxxxxxxxx\n');

// Test nodemailer connection
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

console.log('🔐 Testing SMTP Connection...\n');
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ SMTP Connection Failed');
    console.log(`Error: ${error.message}\n`);
    
    if (error.code === 'EAUTH') {
      console.log('💡 Fix: The app password is incorrect or 2FA is not enabled.');
      console.log('   Check your Gmail account settings for app passwords.');
    }
  } else {
    console.log('✅ SMTP Connection Successful!');
    console.log('Email service is ready to send messages.\n');
  }
  process.exit(error ? 1 : 0);
});
