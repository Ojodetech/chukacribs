const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env.production') });

const {
  sendVerificationEmail,
  sendLandlordDetailsEmail,
  transporter
} = require('./config/email');

const testEmail = async () => {
  console.log('🧪 Testing Email Service...\n');
  console.log('📧 Email Configuration:');
  console.log(`   Service: ${process.env.EMAIL_SERVICE}`);
  console.log(`   Host: ${process.env.EMAIL_HOST}`);
  console.log(`   Port: ${process.env.EMAIL_PORT}`);
  console.log(`   From: ${process.env.EMAIL_FROM}`);
  console.log(`   User: ${process.env.EMAIL_USER}\n`);

  try {
    // Test 1: Verify transporter
    console.log('📤 Test 1: Verifying Gmail SMTP Connection...');
    await transporter.verify();
    console.log('✅ SMTP Connection Successful!\n');

    // Test 2: Send verification email
    console.log('📬 Test 2: Sending Verification Email...');
    const verificationCode = '123456';
    const testEmail = process.env.EMAIL_USER;
    
    const verifyResult = await sendVerificationEmail(testEmail, verificationCode);
    if (verifyResult.success) {
      console.log(`✅ Verification email sent successfully!`);
      console.log(`   Message ID: ${verifyResult.messageId}\n`);
    } else {
      console.log(`❌ Failed to send verification email`);
      console.log(`   Error: ${verifyResult.error}\n`);
    }

    // Test 3: Send landlord details email
    console.log('📬 Test 3: Sending Landlord Details Email...');
    const landlordsResult = await sendLandlordDetailsEmail(testEmail, {
      name: 'John Doe',
      phone: '+254712345678',
      idNumber: '12345678',
      landlordId: '507f1f77bcf86cd799439011',
      activationLink: 'http://localhost:3000/landlord-login'
    });

    if (landlordsResult.success) {
      console.log(`✅ Landlord details email sent successfully!`);
      console.log(`   Message ID: ${landlordsResult.messageId}\n`);
    } else {
      console.log(`❌ Failed to send landlord details email`);
      console.log(`   Error: ${landlordsResult.error}\n`);
    }

    console.log('🎉 Email Service Tests Complete!\n');
    console.log('📧 Check your inbox for test emails');
    process.exit(0);
  } catch (error) {
    console.error('❌ Email Service Error:', error.message);
    process.exit(1);
  }
};

testEmail();
