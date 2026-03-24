require('dotenv').config({ path: '.env.production' });
const axios = require('axios');

// Email template for verification link
const getVerificationEmailTemplate = (name, verificationLink) => {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin: 0; font-size: 28px;">ChukaCribs</h1>
          <p style="color: #7f8c8d; font-size: 14px; margin: 5px 0 0 0;">Student Accommodation Platform</p>
        </div>
        
        <h2 style="color: #34495e; font-size: 20px; margin-bottom: 20px;">Welcome! 👋</h2>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          Thank you for registering with ChukaCribs. To complete your registration and start listing your properties, please verify your email address by clicking the button below.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="display: inline-block; background-color: #3498db; color: white; padding: 14px 40px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 16px;">
            ✅ Verify Email Address
          </a>
        </div>
        
        <p style="color: #7f8c8d; text-align: center; font-size: 12px; margin: 20px 0;">
          Or copy and paste this link in your browser:<br>
          <code style="background-color: #ecf0f1; padding: 8px; border-radius: 4px; word-break: break-all; display: inline-block; margin-top: 8px; font-size: 11px;">${verificationLink}</code>
        </p>
        
        <p style="color: #e74c3c; font-size: 13px; margin: 20px 0; text-align: center;">
          ⏱️ This link expires in <strong>24 hours</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
        
        <div style="text-align: center; color: #7f8c8d; font-size: 12px;">
          <p style="margin: 5px 0;">ChukaCribs - Your Student Home</p>
          <p style="margin: 5px 0;">© 2026 ChukaCribs. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
};

async function testEmailService() {
  try {
    console.log('🧪 Testing Sender Email Service...\n');
    
    // Check environment variables
    console.log('📋 Environment Check:');
    console.log(`   SENDER_API_KEY: ${process.env.SENDER_API_KEY ? `✅ Set (first 20 chars): ${  process.env.SENDER_API_KEY.substring(0, 20)  }...` : '❌ Missing'}`);
    console.log(`   SENDER_API_URL: ${process.env.SENDER_API_URL || 'https://api.sender.net/v4 (default)'}`);
    console.log(`   EMAIL_FROM: ${process.env.EMAIL_FROM || 'no-reply@chukacribs.co.ke (default)'}`);
    console.log(`   EMAIL_FROM_NAME: ${process.env.EMAIL_FROM_NAME || 'ChukaCribs (default)'}\n`);

    if (!process.env.SENDER_API_KEY) {
      throw new Error('SENDER_API_KEY is not set in .env.production');
    }

    const recipientEmail = 'ojodewycliffe0@gmail.com';
    const verificationLink = 'https://chukacribs.com/verify-email?token=test_token_12345678900';
    const recipientName = 'Test User';

    console.log('📧 Sending Test Email:');
    console.log(`   To: ${recipientEmail}`);
    console.log(`   Subject: 🔐 Verify Your Email - ChukaCribs\n`);

    const payload = {
      to: [{ 
        email: recipientEmail,
        name: recipientName
      }],
      from: {
        email: process.env.EMAIL_FROM || 'no-reply@chukacribs.co.ke',
        name: process.env.EMAIL_FROM_NAME || 'ChukaCribs'
      },
      subject: '🔐 Verify Your Email - ChukaCribs',
      html: getVerificationEmailTemplate(recipientName, verificationLink),
      text: `Click the link to verify your email: ${verificationLink}. This link expires in 24 hours.`
    };

    console.log('📤 API Request:');
    console.log(`   URL: ${process.env.SENDER_API_URL || 'https://api.sender.net/v2'}/message/send`);
    console.log(`   Method: POST`);
    console.log(`   Headers: Authorization: Bearer [REDACTED]\n`);

    const response = await axios.post(
      `${process.env.SENDER_API_URL || 'https://api.sender.net/v2'}/message/send`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SENDER_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true // Don't throw on any status
      }
    );

    console.log('📊 API Response:');
    console.log(`   Status Code: ${response.status} ${response.statusText}`);
    console.log(`   Data:\n${JSON.stringify(response.data, null, 2)}\n`);

    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Email sent successfully!\n');
      console.log('\n✨ Test completed successfully!');
      process.exit(0);
    } else {
      console.log(`❌ Request failed with status ${response.status}`);
      console.log(`Error: ${response.data?.message || response.data?.error || 'Unknown error'}`);
      process.exit(1);
    }
    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('📊 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n✨ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test Error:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    
    if (error.response) {
      console.error('\nResponse Details:');
      console.error('Status:', error.response.status, error.response.statusText);
      console.error('Data:', error.response.data);
    }
    
    if (error.request && !error.response) {
      console.error('\nRequest Details:');
      console.error('No response received - connection issue');
    }
    
    process.exit(1);
  }
}

testEmailService();
