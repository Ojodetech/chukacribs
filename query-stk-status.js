require('dotenv').config();
const { queryTransactionStatus } = require('./config/mpesa');

/**
 * 🔍 QUERY TRANSACTION STATUS
 * This will give us more details about why the STK push failed
 */
async function querySTKStatus() {
    try {
        console.log('🔍 QUERYING TRANSACTION STATUS...\n');

        // Use the checkout ID from the debug output
        const checkoutRequestId = 'ws_CO_10042026091307058715255115';

        console.log(`CheckoutRequestID: ${checkoutRequestId}\n`);

        const result = await queryTransactionStatus(checkoutRequestId);

        console.log('📋 QUERY RESULT:');
        console.log(JSON.stringify(result, null, 2));

        if (result.resultCode === '2029') {
            console.log('\n❌ ERROR CODE 2029: Invalid/Inactive account or Account not found');
            console.log('Possible causes:');
            console.log('1. Phone number 254715255115 is not registered with M-Pesa');
            console.log('2. Business shortcode 7980117 is not valid for STK push');
            console.log('3. The PayBill account is not active or configured properly');
        }

    } catch (error) {
        console.error('Query failed:', error.message);
    }
}

querySTKStatus();