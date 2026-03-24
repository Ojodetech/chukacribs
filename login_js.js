// Login page JavaScript - Externalized to bypass CSP restrictions
const form = document.getElementById('loginForm');
const loading = document.getElementById('loading');
const generalError = document.getElementById('generalError');
const successMessage = document.getElementById('successMessage');
const emailInput = document.getElementById('email');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    document.querySelectorAll('.error').forEach(el => el.classList.remove('show'));
    generalError.classList.remove('show');
    successMessage.classList.remove('show');

    // Get form values
    const email = emailInput.value.trim();
    const password = document.getElementById('password').value;

    // Validation
    if (!email) {
        document.getElementById('emailError').textContent = 'Email is required';
        document.getElementById('emailError').classList.add('show');
        return;
    }

    if (!email.includes('@')) {
        document.getElementById('emailError').textContent = 'Please enter a valid email address';
        document.getElementById('emailError').classList.add('show');
        return;
    }

    if (!password) {
        document.getElementById('passwordError').textContent = 'Password is required';
        document.getElementById('passwordError').classList.add('show');
        return;
    }

    try {
        loading.classList.add('show');
        form.classList.add('disabled-form');

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include', // Include cookies for HTTP-only auth
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            form.classList.remove('disabled-form');
            loading.classList.remove('show');

            // Prefer structured error messages from server
            let userMessage = data && (data.message || data.error || (data.errors && data.errors[0] && (data.errors[0].msg || data.errors[0].message)));

            // Handle email verification required error
            if (response.status === 403 && data && data.requiresVerification) {
                generalError.textContent = userMessage || 'Please verify your email before logging in.';
                generalError.classList.add('show');

                // Show resend verification button if not already present
                if (!document.querySelector('.resend-btn')) {
                    const resendBtn = document.createElement('button');
                    resendBtn.type = 'button';
                    resendBtn.textContent = 'Resend Verification Email';
                    resendBtn.className = 'resend-btn';
                    resendBtn.setAttribute('data-action', 'resend-verification');
                    resendBtn.setAttribute('data-email', data.email);

                    const errorDiv = document.getElementById('generalError');
                    errorDiv.appendChild(document.createElement('br'));
                    errorDiv.appendChild(resendBtn);

                    // Add event listener after creating button
                    resendBtn.addEventListener('click', () => resendVerificationEmail(data.email));
                }
            } else {
                generalError.textContent = userMessage || 'Login failed. Please check your credentials.';
                generalError.classList.add('show');
            }
            return;
        }

        // Success - token is in secure HTTP-only cookie
        successMessage.classList.add('show');
        
        // Store only email preference (not token!)
        if (document.getElementById('remember').checked) {
            sessionStorage.setItem('landlordEmail', email);
        } else {
            sessionStorage.removeItem('landlordEmail');
        }
        
        // Hide loading and redirect immediately
        loading.classList.remove('show');
        form.classList.remove('disabled-form');
        
        // Redirect to dashboard
        console.log('Login successful, redirecting to dashboard...');
        window.location.href = '/landlord-dashboard';
        
        // Fallback redirect after 3 seconds if primary fails
        setTimeout(() => {
            window.location.href = '/landlord-dashboard';
        }, 3000);
    } catch (error) {
        form.classList.remove('disabled-form');
        loading.classList.remove('show');
        console.error('Login error:', error);
        generalError.textContent = 'Network error. Please check your connection and try again.';
        generalError.classList.add('show');
    }
});

// Pre-fill email if remembered
window.addEventListener('load', () => {
    const rememberedEmail = sessionStorage.getItem('landlordEmail');
    if (rememberedEmail) {
        emailInput.value = rememberedEmail;
    }
});

// Resend verification email function
async function resendVerificationEmail(email) {
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
            alert('Verification email has been resent! Please check your inbox.');
            window.location.href = `/verify-email-pending?email=${encodeURIComponent(email)}`;
        } else {
            alert(data.message || 'Failed to resend verification email.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error resending verification email. Please try again.');
    }
}
