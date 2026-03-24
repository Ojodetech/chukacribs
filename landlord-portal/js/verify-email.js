/**
 * Email Verification Handler
 * Processes email verification token and manages verification flow
 * CSP-Compliant: No inline scripts or event handlers
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeEmailVerification();
});

function initializeEmailVerification() {
    // Extract token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Attach event listeners
    attachEventListeners();

    if (!token) {
        showError('No verification token provided. Please check your email for the verification link.', 'Invalid Link');
    } else {
        verifyEmail(token);
    }
}

/**
 * Attach all event listeners to buttons
 */
function attachEventListeners() {
    // Use event delegation for all button clicks
    document.addEventListener('click', handleClickEvent);
}

/**
 * Handle click events with data-action attributes
 */
function handleClickEvent(event) {
    const target = event.target;
    const action = target.getAttribute('data-action');
    
    if (!action) {return;}
    
    event.preventDefault();
    event.stopPropagation();
    
    switch(action) {
        case 'go-to-register':
        case 'register-again':
            goToRegister();
            break;
        case 'go-to-login':
        case 'go-to-login-verify':
            goToLogin();
            break;
    }
}

/**
 * Verify email using the token from the URL
 */
async function verifyEmail(token) {
    try {
        const response = await fetch(`/api/auth/verify-email/${token}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess(data);
            // Auto-redirect after 3 seconds
            setTimeout(() => {
                goToLogin();
            }, 3000);
        } else {
            showError(data.message || 'Verification failed', 'Verification Error');
        }
    } catch (error) {
        console.error('Verification error:', error);
        showError(
            'An error occurred during verification. Please check your connection and try again.',
            'Network Error'
        );
    }
}

/**
 * Show success state
 */
function showSuccess(data) {
    const loadingEl = document.getElementById('loading');
    const successEl = document.getElementById('success');

    if (loadingEl) {loadingEl.classList.add('hidden');}
    if (successEl) {successEl.classList.remove('hidden');}
}

/**
 * Show error state
 */
function showError(message, title = 'Error') {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const errorTitle = document.getElementById('errorMessage');
    const errorDetails = document.getElementById('errorDetails');

    if (loadingEl) {loadingEl.classList.add('hidden');}
    if (errorEl) {errorEl.classList.remove('hidden');}
    if (errorTitle) {errorTitle.textContent = title;}
    if (errorDetails) {errorDetails.textContent = message;}
}

/**
 * Navigate to login page
 */
function goToLogin() {
    window.location.href = '/landlord-login';
}

/**
 * Navigate to registration page
 */
function goToRegister() {
    window.location.href = '/landlord-register';
}
