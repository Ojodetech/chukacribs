require('dotenv').config();

// ENFORCE PRODUCTION MODE
process.env.NODE_ENV = 'production';
process.env.USE_MOCK_MPESA = 'false';

const { initiateSTKPush } = require('./config/mpesa');

const debugSTKPush = async () => {
    console.log('🔍 DEBUGGING STK PUSH PAYLOAD\n');

    const phoneNumber = '0715255115';
    const amount = 4000;
    const orderId = 'DEBUG_TEST_' + Date.now();

    console.log('📱 Phone Number:', phoneNumber);
    console.log('💰 Amount:', amount);
    console.log('🆔 Order ID:', orderId);
    console.log();

    // Check environment variables
    console.log('🔧 ENVIRONMENT VARIABLES:');
    console.log('USE_NGROK:', process.env.USE_NGROK);
    console.log('NGROK_URL:', process.env.NGROK_URL);
    console.log('MPESA_CALLBACK_URL:', process.env.MPESA_CALLBACK_URL);
    console.log('MPESA_BUSINESS_SHORTCODE:', process.env.MPESA_BUSINESS_SHORTCODE);
    console.log();

    // Check phone number formatting
    const formatPhoneNumber = (phone) => {
        let cleaned = phone.replace(/\D/g, '');

        if (cleaned.startsWith('0')) {
            cleaned = `254${cleaned.substring(1)}`;
        } else if (!cleaned.startsWith('254')) {
            cleaned = `254${cleaned}`;
        }

        return cleaned;
    };

    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log('📞 FORMATTED PHONE:', formattedPhone);
    console.log();

    // Check callback URL logic
    const callbackUrl = (process.env.USE_NGROK === 'true' || process.env.USE_NGROK === '1') && process.env.NGROK_URL
        ? `${process.env.NGROK_URL.replace(/\/+$/,'')}/api/payment/mpesa-callback`
        : process.env.MPESA_CALLBACK_URL;

    console.log('🔗 CALLBACK URL:', callbackUrl);
    console.log();

    // Check timestamp and password generation
    const timestamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
    const password = Buffer.from(
        `${process.env.MPESA_BUSINESS_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    console.log('⏰ TIMESTAMP:', timestamp);
    console.log('🔑 PASSWORD:', password);
    console.log();

    // Show full payload
    const payload = {
        BusinessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: process.env.MPESA_BUSINESS_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: orderId,
        TransactionDesc: 'ChukaCribs Access Token - 24 Hour Viewing Pass'
    };

    console.log('📋 FULL PAYLOAD:');
    console.log(JSON.stringify(payload, null, 2));
    console.log();

    // Now try the actual call
    console.log('🚀 MAKING STK PUSH CALL...');
    try {
        const result = await initiateSTKPush(phoneNumber, amount, orderId);
        console.log('✅ RESPONSE:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.log('❌ ERROR:', error.message);
        if (error.response?.data) {
            console.log('❌ API RESPONSE:', JSON.stringify(error.response.data, null, 2));
        }
    }
};

debugSTKPush();
