/**
 * Verify Email Pending Page Handler
 * Manages email verification pending state and user interactions
 * CSP-Compliant: No inline scripts or event handlers
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeVerifyEmailPending();
});

function initializeVerifyEmailPending() {
    // Display user email from URL or localStorage
    displayUserEmail();

    // Attach event listeners
    attachEventListeners();
}

/**
 * Display the user's email address on the page
 */
function displayUserEmail() {
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email') || localStorage.getItem('landlordEmail');
    
    if (email) {
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement) {
            userEmailElement.textContent = email;
            localStorage.setItem('landlordEmail', email);
        }
    }
}

/**
 * Attach all event listeners to buttons
 */
function attachEventListeners() {
    // Delegate event listeners using event delegation
    document.addEventListener('click', handleClickEvent);
}

/**
 * Handle all click events with data-action attributes
 */
function handleClickEvent(event) {
    const target = event.target;
    const action = target.getAttribute('data-action');
    
    if (!action) {return;}
    
    event.preventDefault();
    event.stopPropagation();
    
    switch(action) {
        case 'open-email':
            openEmailClient();
            break;
        case 'go-to-login':
            goToLogin();
            break;
        case 'resend-email':
            resendEmail();
            break;
    }
}

/**
 * Open email client or Gmail in new window
 */
function openEmailClient() {
    const email = localStorage.getItem('landlordEmail') || '';
    
    // Open default email client via mailto
    const mailtoLink = email 
        ? `mailto:?subject=ChukaCribs%20Email%20Verification` 
        : 'mailto:';
    window.location.href = mailtoLink;
    
    // Offer to open Gmail/Outlook after short delay
    setTimeout(() => {
        const confirmed = confirm(
            'Would you like to open your email provider in a new window?\n\n' +
            'Click OK to open Gmail (or your email provider in a new tab).'
        );
        if (confirmed) {
            window.open('https://mail.google.com', '_blank');
        }
    }, 500);
}

/**
 * Navigate back to login page
 */
function goToLogin() {
    window.location.href = '/landlord-login';
}

/**
 * Resend verification email to the landlord
 */
async function resendEmail() {
    const email = localStorage.getItem('landlordEmail');
    
    if (!email) {
        alert('Email address not found. Please register again.');
        window.location.href = '/landlord-register';
        return;
    }

    try {
        const response = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            alert('✓ Verification email resent! Check your email inbox and spam folder.');
        } else {
            alert(data.message || 'Failed to resend email. Please try again.');
        }
    } catch (error) {
        console.error('Error resending verification email:', error);
        alert('Network error. Please check your connection and try again.');
    }
}
