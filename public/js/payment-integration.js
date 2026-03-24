/**
 * M-Pesa Payment Integration
 * Handles frontend payment flow for ChukaCribs
 * 
 * Payment Flow:
 * 1. User enters phone number
 * 2. Frontend calls /api/payment/initiate with phone
 * 3. M-Pesa STK prompt appears on user's phone
 * 4. Frontend polls /api/payment/poll-status for payment result
 * 5. Once payment succeeds, unlock access and proceed to booking
 */

class MpesaPaymentManager {
  constructor() {
    this.paymentCheckoutId = null;
    this.pollingInterval = null;
    this.maxPollingAttempts = 60; // Poll for 5 minutes max (60 * 5 seconds)
    this.currentPollingAttempts = 0;
    this.PAYMENT_AMOUNT = 100; // KSH - from environment
    this.POLLING_INTERVAL = 5000; // 5 seconds
  }

  /**
   * Format Kenyan phone number to M-Pesa format (254xxxxxxxxx)
   * Accepts: 0712345678, +254712345678, 254712345678
   * Returns: 254712345678
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) {return null;}
    
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Remove leading 0 if it starts with 0
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Add country code if not present
    if (!cleaned.startsWith('254')) {
      cleaned = `254${  cleaned}`;
    }
    
    // Validate length (254 + 9 digits = 12 total)
    if (cleaned.length !== 12) {
      return null;
    }
    
    return cleaned;
  }

  /**
   * Display phone input error
   */
  showPhoneError(message) {
    const phoneInput = document.getElementById('paymentPhoneNumber');
    const errorDiv = document.getElementById('phoneErrorMessage');
    
    if (phoneInput) {
      phoneInput.classList.add('input-error');
      phoneInput.style.borderColor = '#dc2626';
    }
    
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.classList.add('visible');
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Clear phone input error
   */
  clearPhoneError() {
    const phoneInput = document.getElementById('paymentPhoneNumber');
    const errorDiv = document.getElementById('phoneErrorMessage');
    
    if (phoneInput) {
      phoneInput.classList.remove('input-error');
      phoneInput.style.borderColor = '';
    }
    
    if (errorDiv) {
      errorDiv.classList.remove('visible');
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
    }
  }

  /**
   * Validate Kenyan phone number
   */
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.trim() === '') {
      this.showPhoneError('Phone number is required');
      return false;
    }

    const formatted = this.formatPhoneNumber(phoneNumber);
    if (!formatted) {
      this.showPhoneError('Invalid Kenyan phone number. Use format: 0712345678 or +254712345678');
      return false;
    }

    this.clearPhoneError();
    return formatted;
  }

  /**
   * Initiate M-Pesa STK push payment
   * Shows payment prompt on user's phone
   */
  async initializePayment(phoneNumber) {
    try {
      // Validate and format phone number
      const formattedPhone = this.validatePhoneNumber(phoneNumber);
      if (!formattedPhone) {
        return { success: false, error: 'Invalid phone number' };
      }

      // Show payment initiation status
      this.updatePaymentStatus('processing', 'Initiating M-Pesa payment...');
      this.disablePaymentButton(true);

      // Call backend to initiate STK push
      const response = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || data.message || 'Failed to initiate payment';
        this.updatePaymentStatus('error', `❌ ${errorMsg}`);
        this.disablePaymentButton(false);
        return { success: false, error: errorMsg };
      }

      // Store checkout ID for polling
      this.paymentCheckoutId = data.checkoutRequestId;
      console.log('✅ STK push initiated. Checkout ID:', this.paymentCheckoutId);

      // Update UI
      this.updatePaymentStatus('waiting', `💬 M-Pesa prompt sent to ${formattedPhone}\nEnter your M-Pesa PIN to complete payment`);

      // Start polling for payment result
      this.startPaymentStatusPolling();

      return { success: true, checkoutRequestId: this.paymentCheckoutId };
    } catch (error) {
      console.error('Error initiating payment:', error);
      this.updatePaymentStatus('error', `❌ Network error: ${error.message}`);
      this.disablePaymentButton(false);
      return { success: false, error: error.message };
    }
  }

  /**
   * Poll for payment status
   * Checks every 5 seconds if payment was successful
   */
  startPaymentStatusPolling() {
    if (!this.paymentCheckoutId) {
      console.error('Cannot start polling without checkoutRequestId');
      return;
    }

    this.currentPollingAttempts = 0;

    // Clear previous polling interval if exists
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Start polling
    this.pollingInterval = setInterval(async () => {
      this.currentPollingAttempts++;

      // Stop polling after max attempts
      if (this.currentPollingAttempts > this.maxPollingAttempts) {
        this.stopPaymentStatusPolling();
        this.updatePaymentStatus('error', '⏰ Payment verification timed out. Please try again or contact support.');
        this.disablePaymentButton(false);
        return;
      }

      // Poll status
      const result = await this.checkPaymentStatus(this.paymentCheckoutId);

      if (result.completed) {
        if (result.success) {
          this.handlePaymentSuccess(result);
        } else {
          this.handlePaymentFailure(result);
        }
      } else {
        // Still waiting - update the UI with remaining time
        const elapsedSeconds = this.currentPollingAttempts * 5;
        const remainingSeconds = (this.maxPollingAttempts * 5) - elapsedSeconds;
        console.log(`⏳ Waiting for payment... (${elapsedSeconds}s elapsed)`);
      }
    }, this.POLLING_INTERVAL);
  }

  /**
   * Stop polling for payment status
   */
  stopPaymentStatusPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.currentPollingAttempts = 0;
  }

  /**
   * Query payment status from backend
   */
  async checkPaymentStatus(checkoutRequestId) {
    try {
      const response = await fetch('/api/payment/poll-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checkoutRequestId: checkoutRequestId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error checking payment status:', data);
        return { completed: false };
      }

      return {
        completed: data.status !== 'pending',
        success: data.status === 'completed',
        status: data.status,
        message: data.message,
        responseCode: data.responseCode,
        mpesaReceiptNumber: data.mpesaReceiptNumber
      };
    } catch (error) {
      console.error('Network error checking payment status:', error);
      return { completed: false };
    }
  }

  /**
   * Handle successful payment
   */
  handlePaymentSuccess(result) {
    this.stopPaymentStatusPolling();
    
    console.log('✅ Payment successful!', result);
    this.updatePaymentStatus('success', `✅ Payment successful!\nReceipt: ${result.mpesaReceiptNumber}\n\nProceeding to complete your booking...`);
    
    // Close payment modal and proceed with booking after 2 seconds
    setTimeout(() => {
      this.closePaymentModal();
      this.proceedToBooking();
    }, 2000);
  }

  /**
   * Handle failed payment
   */
  handlePaymentFailure(result) {
    this.stopPaymentStatusPolling();
    
    console.log('❌ Payment failed:', result);
    this.updatePaymentStatus('error', `❌ Payment failed\n${result.message}\n\nPlease try again or contact support.`);
    this.disablePaymentButton(false);
  }

  /**
   * Update payment status display
   */
  updatePaymentStatus(status, message) {
    const statusDiv = document.getElementById('paymentStatus');
    if (!statusDiv) {return;}

    statusDiv.innerHTML = `<p class="payment-status-${status}">${message}</p>`;
    statusDiv.style.display = 'block';

    // Add visual indicators
    const statusBarEl = document.querySelector('.payment-status-bar');
    if (statusBarEl) {
      statusBarEl.className = `payment-status-bar status-${status}`;
    }
  }

  /**
   * Enable/disable payment button
   */
  disablePaymentButton(disabled) {
    const payBtn = document.getElementById('payNowButton');
    if (payBtn) {
      payBtn.disabled = disabled;
      payBtn.textContent = disabled ? '⏳ Processing...' : '💰 Pay with M-Pesa (100 KSH)';
      payBtn.style.opacity = disabled ? '0.6' : '1';
      payBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }
  }

  /**
   * Close payment modal
   */
  closePaymentModal() {
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
      paymentModal.classList.add('hidden');
    }
  }

  /**
   * Proceed to booking confirmation
   * This will be called after successful payment
   */
  proceedToBooking() {
    console.log('Proceeding to booking confirmation...');
    // This will be handled by the main listings.js
    // Trigger custom event or call function from listings.js
    if (window.confirmBooking) {
      window.confirmBooking();
    }
  }

  /**
   * Reset payment modal for new payment attempt
   */
  resetPaymentModal() {
    const phoneInput = document.getElementById('paymentPhoneNumber');
    const statusDiv = document.getElementById('paymentStatus');

    if (phoneInput) {
      phoneInput.value = '';
      phoneInput.classList.remove('input-error');
      phoneInput.style.borderColor = '';
    }

    if (statusDiv) {
      statusDiv.innerHTML = '';
      statusDiv.style.display = 'none';
    }

    this.disablePaymentButton(false);
    this.clearPhoneError();
    this.stopPaymentStatusPolling();
    this.paymentCheckoutId = null;
  }
}

// Initialize payment manager globally
const paymentManager = new MpesaPaymentManager();

// Setup payment modal event listeners once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupPaymentModalListeners();
});

/**
 * Setup payment modal event listeners
 */
function setupPaymentModalListeners() {
  const phoneInput = document.getElementById('paymentPhoneNumber');
  const payNowBtn = document.getElementById('payNowButton');
  const closePaymentBtn = document.getElementById('closePaymentModal');
  const paymentModal = document.getElementById('paymentModal');

  // Close button
  if (closePaymentBtn) {
    closePaymentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Only allow closing if not in middle of payment
      if (!paymentManager.pollingInterval) {
        paymentManager.resetPaymentModal();
        paymentModal.classList.add('hidden');
      }
    });
  }

  // Pay now button
  if (payNowBtn) {
    payNowBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const phoneNumber = phoneInput ? phoneInput.value : '';
      await paymentManager.initializePayment(phoneNumber);
    });
  }

  // Phone input - clear error on focus
  if (phoneInput) {
    phoneInput.addEventListener('focus', () => {
      paymentManager.clearPhoneError();
    });

    // Allow Enter key to submit
    phoneInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && payNowBtn && !payNowBtn.disabled) {
        payNowBtn.click();
      }
    });
  }

  // Close modal when clicking outside
  if (paymentModal) {
    paymentModal.addEventListener('click', (e) => {
      if (e.target === paymentModal && !paymentManager.pollingInterval) {
        paymentManager.resetPaymentModal();
        paymentModal.classList.add('hidden');
      }
    });
  }
}

/**
 * Open payment modal (called from listings.js)
 */
function openPaymentModal() {
  const paymentModal = document.getElementById('paymentModal');
  if (!paymentModal) {
    console.error('Payment modal not found in DOM');
    return;
  }

  paymentManager.resetPaymentModal();
  paymentModal.classList.remove('hidden');
  
  // Focus phone input
  const phoneInput = document.getElementById('paymentPhoneNumber');
  if (phoneInput) {
    setTimeout(() => phoneInput.focus(), 100);
  }

  console.log('Payment modal opened');
}
