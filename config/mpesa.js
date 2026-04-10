const axios = require('axios');

/**
 * M-Pesa Payment Service
 * Handles payment processing via Safaricom's M-Pesa API
 */

const MPESA_API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

const AUTH_URL = `${MPESA_API_BASE}/oauth/v1/generate?grant_type=client_credentials`;
const STK_PUSH_URL = `${MPESA_API_BASE}/mpesa/stkpush/v1/processrequest`;
const TRANSACTION_QUERY_URL = `${MPESA_API_BASE}/mpesa/transactionstatus/v1/query`;

const isMockRequested =
  process.env.USE_MOCK_MPESA === '1' ||
  process.env.USE_MOCK_MPESA === 'true';
const defaultMockMode = process.env.NODE_ENV !== 'production';
const useMock = isMockRequested || defaultMockMode;

console.log('🔧 M-Pesa Configuration:', {
  nodeEnv: process.env.NODE_ENV,
  useMockMpesa: process.env.USE_MOCK_MPESA,
  isMockRequested,
  defaultMockMode,
  useMock,
  hasConsumerKey: !!process.env.MPESA_CONSUMER_KEY,
  hasConsumerSecret: !!process.env.MPESA_CONSUMER_SECRET,
  hasBusinessShortcode: !!process.env.MPESA_BUSINESS_SHORTCODE,
  hasTillNumber: !!process.env.MPESA_TILL_NUMBER,
  hasPasskey: !!process.env.MPESA_PASSKEY,
  hasCallbackUrl: !!process.env.MPESA_CALLBACK_URL
});

if (!useMock) {
  const requiredVars = [
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'MPESA_BUSINESS_SHORTCODE',
    'MPESA_PASSKEY',
    'MPESA_CALLBACK_URL'
  ];

  const missingVars = requiredVars.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required M-Pesa env vars when not in mock mode: ${missingVars.join(', ')}`
    );
  }
}

// Generate M-Pesa Access Token
const generateAccessToken = async () => {
  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.get(AUTH_URL, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error generating M-Pesa access token:', error.message);
    throw new Error('Failed to generate M-Pesa access token');
  }
};

// Create STK Push (Prompt for payment)
const initiateSTKPush = async (phoneNumber, amount, orderId) => {
  try {
    console.log('📱 Initiating STK Push:', {
      phoneNumber,
      amount,
      orderId,
      callbackUrl: process.env.MPESA_CALLBACK_URL
    });

    const accessToken = await generateAccessToken();
    console.log('🔑 Access token obtained');

    const timestamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);

    // Create password: Base64(BusinessShortCode + Passkey + Timestamp)
    const password = Buffer.from(
      `${process.env.MPESA_BUSINESS_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    // Determine callback URL: prefer NGROK tunnel when enabled for local testing
    const callbackUrl = (process.env.USE_NGROK === 'true' || process.env.USE_NGROK === '1') && process.env.NGROK_URL
      ? `${process.env.NGROK_URL.replace(/\/+$/,'')}/api/payment/callback`
      : process.env.MPESA_CALLBACK_URL;

    const payload = {
      BusinessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: Math.round(amount), // Ensure integer
      PartyA: formatPhoneNumber(phoneNumber), // Customer phone
      PartyB: process.env.MPESA_TILL_NUMBER || process.env.MPESA_BUSINESS_SHORTCODE, // Till number for buygoods
      PhoneNumber: formatPhoneNumber(phoneNumber),
      CallBackURL: callbackUrl,
      AccountReference: orderId,
      TransactionDesc: 'ChukaCribs Access Token - 24 Hour Viewing Pass'
    };

    console.log('📤 Sending STK Push request to Safaricom:', {
      url: STK_PUSH_URL,
      payload: { ...payload, Password: '***HIDDEN***' }
    });

    const response = await axios.post(STK_PUSH_URL, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ STK RESPONSE:', response.data);

    const responseCode = response.data?.ResponseCode;
    if (responseCode !== '0' && responseCode !== 0) {
      const errorMessage = response.data?.ResponseDescription || 'STK Push request rejected by Safaricom';
      console.error('❌ M-Pesa STK push rejected:', response.data);
      return {
        success: false,
        error: errorMessage,
        response: response.data
      };
    }

    return {
      success: true,
      checkoutRequestId: response.data.CheckoutRequestID,
      responseCode,
      message: response.data.ResponseDescription
    };
  } catch (error) {
    console.error('🔥 SAFARICOM ERROR:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.errorMessage || error.message
    };
  }
};

// Query Transaction Status
const queryTransactionStatus = async (checkoutRequestId) => {
  try {
    const accessToken = await generateAccessToken();
    const timestamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);

    const password = Buffer.from(
      `${process.env.MPESA_BUSINESS_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const payload = {
      BusinessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };

    const response = await axios.post(
      `${MPESA_API_BASE}/mpesa/stkpushquery/v1/query`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: response.data.ResponseCode === '0',
      responseCode: response.data.ResponseCode,
      resultCode: response.data.ResultCode,
      message: response.data.ResponseDescription,
      resultDesc: response.data.ResultDesc
    };
  } catch (error) {
    console.error('Error querying transaction:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Format phone number to M-Pesa format (254XXXXXXXXX)
const formatPhoneNumber = (phone) => {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = `254${  cleaned.substring(1)}`;
  } else if (!cleaned.startsWith('254')) {
    cleaned = `254${  cleaned}`;
  }
  
  return cleaned;
};

// At the very end we decide whether to use the real M-Pesa logic or the
// mock implementation. The mock is handy when the Safaricom API is slow/unavailable
// or while developing on localhost. To enable set USE_MOCK_MPESA to "1" or
// "true" in your environment.

// decide whether to divert all calls to the built-in mock
// - setting USE_MOCK_MPESA to "1" or "true" always enables a mock
// - in non-production environments we default to mock mode so that
//   env/network glitches (sandbox outages, timeouts) don't interfere
//   with local development.  Set USE_MOCK_MPESA explicitly to "false"
//   if you really need to hit the real API while still in development.

if (useMock) {
  console.warn('⚠️  M-Pesa mock mode enabled (USE_MOCK_MPESA)');
  module.exports = require('./mpesa-mock');
} else {
  module.exports = {
    generateAccessToken,
    initiateSTKPush,
    queryTransactionStatus,
    formatPhoneNumber
  };
}
