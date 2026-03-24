// Handles the standalone payment page logic
const loader = new LoadingManager();
const errorMgr = new ErrorManager();

// Small top-of-page overlay to show M-Pesa prompt + loading state
function ensureMpesaOverlay() {
    let el = document.getElementById('mpesa-prompt-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mpesa-prompt-overlay';
        el.className = 'mpesa-prompt-overlay hidden';
        el.innerHTML = `
            <div class="mpesa-prompt-inner">
                <div class="mpesa-spinner" aria-hidden="true"></div>
                <div class="mpesa-text">Preparing M-Pesa prompt...</div>
            </div>
        `;
        document.body.appendChild(el);
    }
    return el;
}

function showMpesaPrompt(message) {
    const el = ensureMpesaOverlay();
    el.querySelector('.mpesa-text').textContent = message;
    el.classList.remove('hidden');
}

function hideMpesaPrompt() {
    const el = document.getElementById('mpesa-prompt-overlay');
    if (el) el.classList.add('hidden');
}

// expose globally so other pages (landing modal) can use it
window.showMpesaPrompt = showMpesaPrompt;
window.hideMpesaPrompt = hideMpesaPrompt;

function normalizePhone(input) {
    // Convert 07xxxx to 2547xxxxx, remove any non-digits
    let cleaned = input.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.slice(1);
    }
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.slice(1);
    }
    return cleaned;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function handleFormSubmit(e) {
    e.preventDefault();

    const emailField = document.getElementById('email');
    const mpesaField = document.getElementById('mpesa');

    const email = emailField.value.trim();
    const mpesa = mpesaField.value.trim();

    // fixed amount
    const amount = 100;

    // basic validation
    if (!email || !mpesa) {
        errorMgr.show('Please fill in all fields.', 'error');
        return;
    }
    if (!validateEmail(email)) {
        errorMgr.show('Please enter a valid email address.', 'error');
        return;
    }
    const phoneNumber = normalizePhone(mpesa);
    const phoneRegex = /^(?:254|\+?254)[1-9]\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        errorMgr.show('Please enter a valid Kenyan Mpesa number (e.g. 0712345678).', 'error');
        return;
    }

    // disable button and show top prompt
    const submitBtn = document.querySelector('.payment-form button[type="submit"]');
    loader.showButtonLoading(submitBtn, 'Processing...');
    showMpesaPrompt('Please check your phone for the M-Pesa prompt.');

    // send to backend
    fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, email, amount })
    })
    .then(res => res.json().then(data => ({status: res.status, body: data})))
    .then(({status, body}) => {
        loader.hide();
        loader.hideButtonLoading(submitBtn);
        if (!body.success) {
            const msg = body.error || body.message || 'Failed to start payment';
            errorMgr.show(msg, 'error');
            hideMpesaPrompt();
            return;
        }

        // store checkout id and contact info
        sessionStorage.setItem('checkoutRequestId', body.checkoutRequestId || body.orderTrackingId);
        sessionStorage.setItem('phoneNumber', phoneNumber);
        sessionStorage.setItem('email', email);

        // update overlay message and continue polling
        showMpesaPrompt('M-Pesa prompt sent to ' + phoneNumber + '. Waiting for confirmation...');
        errorMgr.show('M-Pesa prompt sent. Enter your PIN to complete payment.', 'success', 4000);

        pollPaymentStatus(body.checkoutRequestId || body.orderTrackingId);
    })
    .catch(err => {
        loader.hide();
        loader.hideButtonLoading(submitBtn);
        console.error('Payment init error:', err);
        hideMpesaPrompt();
        errorMgr.show('Payment initiation failed. Please try again.', 'error');
    });
}

function pollPaymentStatus(checkoutId) {
    let pollCount = 0;
    const maxPolls = 30;
    const interval = setInterval(() => {
        pollCount++;
        if (pollCount > maxPolls) {
            clearInterval(interval);
            hideMpesaPrompt();
            errorMgr.show('Payment timed out. Check your phone or try again.', 'info', 5000);
            return;
        }

        fetch('/api/payments/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderTrackingId: checkoutId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.status === 'COMPLETED') {
                clearInterval(interval);
                hideMpesaPrompt();
                
                // Show styled success confirmation modal
                errorMgr.showConfirmation('Payment Successful!', [
                    '✅ Your payment of KSH 100.00 has been confirmed.',
                    'You now have access to all house listings in Chuka.',
                    'You will be redirected to browse available accommodations.'
                ], () => {
                    window.location.href = '/listings.html';
                });
            }
        })
        .catch(err => {
            console.error('Polling error:', err);
        });
    }, 3000);
}

// attach listener
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.payment-form');
    // amount is fixed; hidden field already set
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
});
