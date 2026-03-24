/**
 * Verify Email Success Page Handler
 * Manages email verification success state and navigation
 * CSP-Compliant: No inline scripts or event handlers
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeVerifyEmailSuccess();
});

function initializeVerifyEmailSuccess() {
    // Start countdown timer
    startCountdown();

    // Attach event listeners
    attachEventListeners();
}

/**
 * Start countdown and auto-redirect
 */
function startCountdown() {
    let countdown = 5;
    const timerElement = document.getElementById('timer');

    const interval = setInterval(() => {
        countdown--;
        if (timerElement) {
            timerElement.textContent = countdown;
        }

        if (countdown === 0) {
            clearInterval(interval);
            goToLogin();
        }
    }, 1000);
}

/**
 * Attach all event listeners to buttons
 */
function attachEventListeners() {
    const loginBtn = document.querySelector('[data-action="go-to-login"]');
    const registerBtn = document.querySelector('[data-action="go-to-register"]');

    if (loginBtn) {
        loginBtn.addEventListener('click', goToLogin);
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', goToRegister);
    }
}

/**
 * Navigate to login page
 */
function goToLogin() {
    clearStoredData();
    window.location.href = '/landlord-login';
}

/**
 * Navigate to registration page
 */
function goToRegister() {
    window.location.href = '/landlord-register';
}

/**
 * Clear any stored email data for privacy
 */
function clearStoredData() {
    localStorage.removeItem('landlordEmail');
    sessionStorage.clear();
}
