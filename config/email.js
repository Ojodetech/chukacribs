// email.js — Production-ready Sender API integration
const axios = require('axios');
const logger = require('./logger');

// Short-circuit email sending in tests or when disabled via env
if (process.env.NODE_ENV === 'test' || process.env.DISABLE_EMAIL === 'true') {
  module.exports = {
    sendEmail: async ({ to, subject, html, text }) => ({ success: true, mocked: true }),
    sendVerificationEmail: async (email, token) => ({ success: true, mocked: true }),
    sendAccountVerifiedEmail: async (email) => ({ success: true, mocked: true }),
    sendLandlordDetailsEmail: async (email, details) => ({ success: true, mocked: true }),
    sendVerificationEmailWithLink: async (email, options) => ({ success: true, mocked: true })
  };
} else {

/**
 * sendEmail
 * Sends an email via Sender API using environment variables
 * @param {Object} mailOptions
 * @param {string} mailOptions.to - recipient email
 * @param {string} mailOptions.subject - email subject
 * @param {string} mailOptions.html - HTML content
 * @param {string} [mailOptions.text] - Optional plain-text content
 */
async function sendEmail({ to, subject, html, text }) {
  if (!to || !subject || !html) {
    throw new Error('Missing required email fields: to, subject, or html');
  }

  try {
    // Validate environment variables
    const apiKey = process.env.SENDER_API_KEY;
    if (!apiKey) {
      // In development, log warning but don't fail
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(`⚠️ Email not sent (API key missing): To: ${to}, Subject: ${subject}`);
        return { success: true, dev_mode: true, message: 'Email skipped (development mode - API key not configured)' };
      }
      throw new Error('SENDER_API_KEY is not set in environment variables');
    }

    const apiUrl = process.env.SENDER_API_URL || 'https://api.sender.net/v2';
    const fromEmail = process.env.EMAIL_FROM || 'no-reply@chukacribs.co.ke';
    const fromName = process.env.EMAIL_FROM_NAME || 'ChukaCribs';
    const replyToEmail = process.env.EMAIL_REPLY_TO || fromEmail;
    const replyToName = process.env.EMAIL_REPLY_TO_NAME || fromName;

    // Build the endpoint URL - use /message/send for Sender v2 API
    const endpoint = `${apiUrl}/message/send`;
    logger.info(`📧 Sending email to ${to} via ${endpoint}`);

    // Build payload
    const payload = {
      from: {
        email: fromEmail,
        name: fromName
      },
      to: {
        email: to,
        name: 'User'
      },
      reply_to: {
        email: replyToEmail,
        name: replyToName
      },
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    };

    logger.debug('📤 Request payload:', payload);

    // Make API request
    const response = await axios.post(
      endpoint,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true // Don't throw on any status code
      }
    );

    // Log response
    logger.info(`📬 API Response Status: ${response.status}`);
    logger.debug('📬 API Response Data:', response.data);

    // Check for success
    if (response.status >= 200 && response.status < 300) {
      logger.info(`✅ Email sent to ${to}: ${response.status} ${response.statusText}`);
      return response.data;
    } else {
      // Log error details
      const errorMsg = response.data?.message || response.data?.error || response.statusText;
      logger.error(`❌ API Error ${response.status}: ${errorMsg}`);
      throw new Error(`Email API returned ${response.status}: ${errorMsg}`);
    }
  } catch (err) {
    const status = err.response?.status;
    const errorData = err.response?.data;
    const errorMessage = err.message;
    
    logger.error(`❌ Failed to send email to ${to}:`, {
      status,
      statusText: err.response?.statusText,
      data: errorData,
      message: errorMessage,
      code: err.code
    });
    
    throw new Error(`Email sending failed: ${errorMessage}`);
  }
}

/**
 * sendVerificationEmail - Send email verification link to newly registered user
 * @param {string} email - User email
 * @param {string} token - Verification token
 */
async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Verify Your Email</h2>
      <p>Thank you for registering with ChukaCribs!</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p>
        <a href="${verificationUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Verify Email
        </a>
      </p>
      <p style="color: #666; font-size: 12px;">Or copy and paste this link: ${verificationUrl}</p>
      <p style="color: #999; font-size: 11px;">This link expires in 24 hours.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your Email - ChukaCribs',
    html
  });
}

/**
 * sendAccountVerifiedEmail - Send confirmation email after successful verification
 * @param {string} email - User email
 */
async function sendAccountVerifiedEmail(email) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">Email Verified!</h2>
      <p>Your email has been successfully verified.</p>
      <p>You can now log in to your ChukaCribs account.</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/landlord-login" 
           style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Go to Login
        </a>
      </p>
      <p style="color: #999; font-size: 11px;">If you didn't create this account, please contact support.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Email Verified - ChukaCribs',
    html
  });
}

/**
 * sendLandlordDetailsEmail - Send landlord onboarding details
 * @param {string} email - Landlord email
 * @param {Object} details - Landlord details {name, phone, etc}
 */
async function sendLandlordDetailsEmail(email, details = {}) {
  const { name = 'Landlord', dashboardUrl } = details;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Welcome to ChukaCribs, ${name}!</h2>
      <p>Your landlord account has been successfully set up.</p>
      <p>You can now:</p>
      <ul style="line-height: 1.8;">
        <li>List your properties</li>
        <li>Manage bookings</li>
        <li>Track earnings</li>
        <li>Connect with verified students</li>
      </ul>
      <p>
        <a href="${dashboardUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'  }/landlord-dashboard`}" 
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Go to Dashboard
        </a>
      </p>
      <p style="color: #999; font-size: 11px;">Welcome aboard!</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to ChukaCribs - Landlord Portal',
    html
  });
}

/**
 * sendVerificationEmailWithLink - Send verification link to new landlord
 * @param {string} email - User email
 * @param {Object} options - Options {name, verificationLink}
 */
async function sendVerificationEmailWithLink(email, options = {}) {
  const { name = 'User', verificationLink } = options;
  
  if (!verificationLink) {
    throw new Error('Verification link is required');
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Welcome to ChukaCribs, ${name}!</h2>
      <p>Thank you for registering as a landlord on ChukaCribs.</p>
      <p>Please verify your email address by clicking the button below:</p>
      <p>
        <a href="${verificationLink}" 
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Verify Email Address
        </a>
      </p>
      <p style="color: #666; font-size: 12px;">Or copy and paste this link: <br/>${verificationLink}</p>
      <p style="color: #999; font-size: 11px;">This link expires in 24 hours.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #999; font-size: 11px;">Questions? Contact us at support@chukacribs.co.ke</p>
    </div>
  `;

  const result = await sendEmail({
    to: email,
    subject: 'Verify Your Email - ChukaCribs Landlord',
    html
  });

  return { success: true, result };
}
// Export functions when email sending is enabled
module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendAccountVerifiedEmail,
  sendLandlordDetailsEmail,
  sendVerificationEmailWithLink
};

}

