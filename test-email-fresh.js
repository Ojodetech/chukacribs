// Fresh test without dotenv caching
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Read .env.production directly
const envPath = path.join(__dirname, '.env.production');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse EMAIL_USER and EMAIL_PASSWORD
const emailUser = envContent.match(/EMAIL_USER=(.+)/)?.[1] || '';
const emailPassword = envContent.match(/EMAIL_PASSWORD=(.+)/)?.[1] || '';
const emailHost = envContent.match(/EMAIL_HOST=(.+)/)?.[1] || 'smtp.gmail.com';
const emailPort = envContent.match(/EMAIL_PORT=(.+)/)?.[1] || '587';

console.log('🧪 Fresh Email Service Test (No Caching)\n');
console.log('📧 Configuration from .env.production:');
console.log(`   EMAIL_USER: ${emailUser}`);
console.log(`   EMAIL_PASSWORD: ${emailPassword}`);
console.log(`   PASSWORD LENGTH: ${emailPassword.length} characters`);
console.log(`   EMAIL_HOST: ${emailHost}`);
console.log(`   EMAIL_PORT: ${emailPort}\n`);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: emailHost,
  port: parseInt(emailPort),
  secure: false,
  auth: {
    user: emailUser,
    pass: emailPassword
  }
});

console.log('🔐 Testing SMTP Connection...\n');
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ SMTP Connection Failed');
    console.log(`Error Code: ${error.code}`);
    console.log(`Error Message: ${error.message}\n`);
    process.exit(1);
  } else {
    console.log('✅ SMTP Connection SUCCESSFUL!\n');
    console.log('🎉 Email Service is ready to send messages!');
    console.log('📧 You can now use the email verification and landlord details features.\n');
    process.exit(0);
  }
});
