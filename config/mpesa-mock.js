// Lightweight M-Pesa mock implementation used during development or when the real
// API is unreachable. Controlled via the USE_MOCK_MPESA environment variable.

// internal store for pending transactions
const pending = new Map();

// simple phone formatter (mimics real format logic)
const formatPhoneNumber = (phone) => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = `254${cleaned.substring(1)}`;
  } else if (!cleaned.startsWith('254')) {
    cleaned = `254${cleaned}`;
  }
  return cleaned;
};

const initiateSTKPush = async (phoneNumber, amount, orderId) => {
  // create a fake checkout id and store record
  const checkoutRequestId = `MOCK_${Date.now()}_${Math.floor(Math.random()*10000)}`;
  pending.set(checkoutRequestId, { phoneNumber: formatPhoneNumber(phoneNumber),
                                    amount,
                                    orderId,
                                    attempts: 0 });

  console.log('[[MPESA MOCK]] STK push initiated', { checkoutRequestId, phoneNumber, amount, orderId });
  return {
    success: true,
    checkoutRequestId,
    responseCode: '0',
    message: 'Mock STK push created'
  };
};

const queryTransactionStatus = async (checkoutRequestId) => {
  const record = pending.get(checkoutRequestId);
  if (!record) {
    return { success: false, error: 'unknown checkoutRequestId' };
  }

  // simulate a delay: first call is pending, second call completes
  record.attempts += 1;
  if (record.attempts < 2) {
    return {
      success: false,
      responseCode: '1',
      resultCode: null,
      message: 'Pending',
      resultDesc: 'Payment is still processing (mock)'
    };
  }

  // on second (or later) attempt treat as successful
  pending.delete(checkoutRequestId);
  return {
    success: true,
    responseCode: '0',
    resultCode: '0',
    message: 'The service request is processed successfully',
    resultDesc: 'The service request is processed successfully.'
  };
};

module.exports = {
  initiateSTKPush,
  queryTransactionStatus,
  formatPhoneNumber
};
