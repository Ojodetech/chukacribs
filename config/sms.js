const axios = require('axios');
const logger = require('./logger');

// SMS Service Configuration
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'africastalking';
const AFRICASTALKING_USERNAME = process.env.AFRICASTALKING_USERNAME;
const AFRICASTALKING_API_KEY = process.env.AFRICASTALKING_API_KEY;
const TEXTSMS_API_KEY = process.env.TEXTSMS_API_KEY;
const TEXTSMS_SENDER_ID = process.env.TEXTSMS_SENDER_ID;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || 'CHUKACRIBS';
const SMS_ENABLED = process.env.SMS_ENABLED === 'true';
const SMS_CRITICAL_MODE = process.env.SMS_CRITICAL_MODE === 'true'; // Only use SMS for critical features

/**
 * Send SMS message using Africa's Talking or TextSMS API
 * @param {string} phoneNumber - Recipient phone number (format: 254712345678 or +254712345678)
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} API response
 */
const sendSMS = async (phoneNumber, message) => {
  if (!SMS_ENABLED) {
    logger.warn(`SMS disabled - skipping SMS to ${phoneNumber}`);
    return { success: false, reason: 'SMS_DISABLED' };
  }

  // Validate credentials
  if (SMS_PROVIDER === 'africastalking' && (!AFRICASTALKING_USERNAME || !AFRICASTALKING_API_KEY)) {
    logger.error('Africa\'s Talking credentials not configured');
    return { success: false, reason: 'AFRICASTALKING_CREDENTIALS_MISSING' };
  }

  if (SMS_PROVIDER === 'textsms' && !TEXTSMS_API_KEY) {
    logger.error('TextSMS API key not configured');
    return { success: false, reason: 'TEXTSMS_API_KEY_MISSING' };
  }

  try {
    let response;

    if (SMS_PROVIDER === 'africastalking') {
      // Format phone number for Africa's Talking (expects: +254712345678)
      let formattedPhone = phoneNumber.replace(/^\+/, ''); // Remove + if present
      if (formattedPhone.startsWith('0')) {
        formattedPhone = `+254${formattedPhone.substring(1)}`; // Replace 0 with +254
      } else if (!formattedPhone.startsWith('254')) {
        formattedPhone = `+254${formattedPhone}`; // Add country code
      } else {
        formattedPhone = `+${formattedPhone}`; // Add + if missing
      }

      // Africa's Talking API
      const auth = Buffer.from(`${AFRICASTALKING_USERNAME}:${AFRICASTALKING_API_KEY}`).toString('base64');

      response = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        new URLSearchParams({
          username: AFRICASTALKING_USERNAME,
          to: formattedPhone,
          message: message
          // from: SMS_SENDER_ID  // Remove sender ID for now
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'apiKey': AFRICASTALKING_API_KEY
          }
        }
      );
    } else if (SMS_PROVIDER === 'textsms') {
      // Format phone number for TextSMS (expects: 254712345678)
      let formattedPhone = phoneNumber.replace(/^\+/, ''); // Remove + if present
      if (formattedPhone.startsWith('0')) {
        formattedPhone = `254${formattedPhone.substring(1)}`; // Replace 0 with 254
      } else if (!formattedPhone.startsWith('254')) {
        formattedPhone = `254${formattedPhone}`; // Add country code
      }

      // TextSMS API
      response = await axios.post(
        'https://sms.textsms.co.ke/api/services/sendsms/',
        {
          apikey: TEXTSMS_API_KEY,
          partnerID: 1, // Default partner ID
          mobile: formattedPhone,
          message: message,
          shortcode: TEXTSMS_SENDER_ID || SMS_SENDER_ID,
          pass_type: 'plain'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );
    } else {
      throw new Error(`Unsupported SMS provider: ${SMS_PROVIDER}`);
    }

    logger.info(`SMS sent to ${phoneNumber} via ${SMS_PROVIDER}`, {
      status: response?.data?.responses?.[0]?.['response-description'] || response?.data?.SMSMessageData?.Recipients?.[0]?.status,
      messageId: response?.data?.responses?.[0]?.messageid || response?.data?.SMSMessageData?.Recipients?.[0]?.messageId,
      response: response?.data
    });

    return {
      success: response?.data?.responses?.[0]?.['respose-code'] === 200 || response?.data?.SMSMessageData?.Recipients?.[0]?.status === 'Success',
      phoneNumber,
      messageId: response?.data?.responses?.[0]?.messageid || response?.data?.SMSMessageData?.Recipients?.[0]?.messageId,
      statusCode: response?.status,
      response: response?.data,
      provider: SMS_PROVIDER
    };
  } catch (error) {
    const responseData = error?.response?.data || {};
    const safeError = (error && error.message) ? error.message : 'Unknown error';

    logger.error(`SMS sending failed to ${phoneNumber} via ${SMS_PROVIDER}`, {
      error: safeError,
      response: responseData
    });

    return {
      success: false,
      phoneNumber,
      error: safeError,
      reason: responseData['response-description'] || responseData.error || 'UNKNOWN_ERROR',
      provider: SMS_PROVIDER
    };
  }
};

/**
 * Send verification code (CRITICAL FEATURE)
 * Only sends if SMS_CRITICAL_MODE is enabled
 * @param {string} phoneNumber - Landlord phone number
 * @param {string} verificationCode - 6-digit verification code
 * @returns {Promise<Object>} SMS result
 */
const sendVerificationCode = async (phoneNumber, verificationCode) => {
  if (!SMS_CRITICAL_MODE) {
    logger.warn(`Verification SMS blocked - SMS in non-critical mode. Code: ${verificationCode}`);
    return { 
      success: false, 
      reason: 'SMS_NON_CRITICAL_MODE',
      note: 'Set SMS_CRITICAL_MODE=true to enable verification SMS'
    };
  }

  const message = `Your ChukaCribs phone verification code is: ${verificationCode}. This code expires in 15 minutes.`;
  return sendSMS(phoneNumber, message);
};

/**
 * Send booking confirmation to user (NON-CRITICAL)
 * Safe to use while SMS service is being tested
 * @param {string} phoneNumber - User phone number
 * @param {Object} bookingDetails - Booking information
 * @returns {Promise<Object>} SMS result
 */
const sendBookingConfirmation = async (phoneNumber, bookingDetails) => {
  const {
    houseName,
    landlordName,
    landlordPhone,
    checkInDate,
    checkOutDate,
    amount,
    bookingCode
  } = bookingDetails;

  const message = `Booking confirmed! ${houseName} - ${checkInDate} to ${checkOutDate}. Amount: KES${amount}. Landlord: ${landlordName} (${landlordPhone}). Booking ID: ${bookingCode}`;
  
  return sendSMS(phoneNumber, message);
};

/**
 * Send house details to interested user
 * @param {string} phoneNumber - User phone number
 * @param {Object} houseDetails - House information
 * @returns {Promise<Object>} SMS result
 */
const sendHouseDetails = async (phoneNumber, houseDetails) => {
  const {
    houseName,
    location,
    price,
    bedrooms,
    landlordPhone,
    verificationLink
  } = houseDetails;

  const message = `${houseName} - ${bedrooms}BR in ${location}. KES${price}/month. Contact Landlord: ${landlordPhone}. Details: ${verificationLink}`;
  
  return sendSMS(phoneNumber, message);
};

/**
 * Send payment confirmation to user
 * @param {string} phoneNumber - User phone number
 * @param {Object} paymentDetails - Payment information
 * @returns {Promise<Object>} SMS result
 */
const sendPaymentConfirmation = async (phoneNumber, paymentDetails) => {
  const {
    amount,
    transactionId,
    accessDuration,
    expiryDate
  } = paymentDetails;

  const message = `Payment received! KES${amount} (Ref: ${transactionId}). ${accessDuration} access to house listings. Expires: ${expiryDate}.`;
  
  return sendSMS(phoneNumber, message);
};

/**
 * Send landlord registration confirmation
 * @param {string} phoneNumber - Landlord phone number
 * @param {Object} landlordDetails - Landlord information
 * @returns {Promise<Object>} SMS result
 */
const sendLandlordRegistrationConfirmation = async (phoneNumber, landlordDetails) => {
  const {
    name,
    email,
    loginUrl
  } = landlordDetails;

  const message = `Welcome to ChukaCribs, ${name}! Registration successful. Login: ${loginUrl}. Questions? Reply to this message.`;
  
  return sendSMS(phoneNumber, message);
};

/**
 * Send new booking notification to landlord
 * @param {string} phoneNumber - Landlord phone number
 * @param {Object} bookingDetails - Booking information
 * @returns {Promise<Object>} SMS result
 */
const sendNewBookingNotification = async (phoneNumber, bookingDetails) => {
  const {
    houseName,
    checkInDate,
    checkOutDate,
    dashboardUrl,
    bookingCode
  } = bookingDetails;

  // Do not include personally-identifying information (user email/phone/name)
  // when notifying landlords. Provide anonymized notification and a booking
  // reference or dashboard link so landlords can view aggregated stats only.
  const message = `New booking for ${houseName} from ${checkInDate} to ${checkOutDate}. Booking ref: ${bookingCode || 'N/A'}. Manage: ${dashboardUrl}`;
  
  return sendSMS(phoneNumber, message);
};

/**
 * Generate random verification code
 * @param {number} length - Code length (default 6)
 * @returns {string} Verification code
 */
const generateVerificationCode = (length = 6) => {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
};

module.exports = {
  sendSMS,
  sendVerificationCode,
  sendBookingConfirmation,
  sendHouseDetails,
  sendPaymentConfirmation,
  sendLandlordRegistrationConfirmation,
  sendNewBookingNotification,
  generateVerificationCode,
  SMS_CRITICAL_MODE,
  SMS_SENDER_ID,
  SMS_PROVIDER,
  SMS_SENDER_ID
};
