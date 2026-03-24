/**
 * Password Visibility Toggle Module
 * Provides show/hide password functionality for form inputs
 * CSP-compliant (no inline event handlers)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all password toggle buttons
    initializePasswordToggles();
});

function initializePasswordToggles() {
    const passwordToggles = document.querySelectorAll('[data-action="toggle-password"]');
    
    passwordToggles.forEach(btn => {
        btn.addEventListener('click', handlePasswordToggle);
    });
}

function handlePasswordToggle(event) {
    event.preventDefault();
    
    // Get the associated password input
    const inputId = event.currentTarget.dataset.target;
    const passwordInput = document.getElementById(inputId);
    
    if (!passwordInput) {return;}
    
    const isPassword = passwordInput.type === 'password';
    
    // Toggle input type
    passwordInput.type = isPassword ? 'text' : 'password';
    
    // Update button appearance
    const isVisible = passwordInput.type === 'text';
    event.currentTarget.classList.toggle('password-visible', isVisible);
    event.currentTarget.classList.toggle('password-hidden', !isVisible);
    
    // Update aria-label for accessibility
    event.currentTarget.setAttribute(
        'aria-label',
        isVisible ? 'Hide password' : 'Show password'
    );
    
    // Focus back on input for better UX
    passwordInput.focus();
}

/**
 * Helper function to check if password input has content
 * Can be used for progressive enhancement
 */
function updatePasswordToggleVisibility(passwordInputId) {
    const input = document.getElementById(passwordInputId);
    const toggle = document.querySelector(`[data-target="${passwordInputId}"]`);
    
    if (!input || !toggle) {return;}
    
    // Show toggle only if input has content
    const hasContent = input.value.length > 0;
    toggle.style.opacity = hasContent ? '1' : '0.5';
}

// Export for external use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initializePasswordToggles, handlePasswordToggle, updatePasswordToggleVisibility };
}
