require('dotenv').config();
process.env.NODE_ENV = 'production';
process.env.USE_MOCK_MPESA = 'false';

const axios = require('axios');

const testSTKPush = async () => {
    try {
        console.log('🚀 Testing STK Push for 0715255115\n');
        console.log('=' .repeat(70));

        // Test data
        const testData = {
            bookingId: '69ef0af055109c9a33f9c245',
            phone: '0715255115'
        };

        console.log('📞 Phone Number: 0715255115');
        console.log('📋 Booking ID: 69ef0af055109c9a33f9c245');
        console.log('💰 Amount: KSH 4000\n');

        console.log('💳 Initiating STK Push...');
        console.log('=' .repeat(70) + '\n');

        const response = await axios.post('http://localhost:3000/api/core/pay', testData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ STK PUSH SUCCESSFUL!\n');
        console.log('=' .repeat(70));
        console.log('📊 RESPONSE:');
        console.log('=' .repeat(70));
        console.log(JSON.stringify(response.data, null, 2));
        console.log('=' .repeat(70) + '\n');

        // Parse response
        if (response.data.checkoutRequestId) {
            console.log(`📌 Checkout Request ID: ${response.data.checkoutRequestId}`);
            console.log(`🔔 Response Code: ${response.data.responseCode}`);
            console.log(`📝 Response Description: ${response.data.responseDescription}\n`);
            
            console.log('👤 Student should receive STK prompt on 0715255115');
            console.log('📲 Check your phone for the M-Pesa STK push notification\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR OCCURRED!\n');
        console.log('=' .repeat(70));
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.message) {
            console.log('Message:', error.message);
        } else {
            console.log(error);
        }
        console.log('=' .repeat(70) + '\n');
        process.exit(1);
    }
};

testSTKPush();
