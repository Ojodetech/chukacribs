// Registration page JavaScript - Externalized to bypass CSP restrictions

// Initialize DOM elements safely after the DOM is fully loaded
let form, passwordInput, loading, generalError, successMessage;
let loader, errorMgr, validator;

function initializeDOMElements() {
    // Safely get form and input elements
    form = document.getElementById('registerForm');
    passwordInput = document.getElementById('password');
    loading = document.getElementById('loading');
    generalError = document.getElementById('generalError');
    successMessage = document.getElementById('successMessage');

    // Verify critical elements exist before proceeding
    if (!form || !passwordInput) {
        console.error('Critical form elements not found in DOM');
        return false;
    }

    // Initialize utility managers (these should be loaded from external scripts)
    if (typeof LoadingManager === 'undefined' || typeof ErrorManager === 'undefined' || typeof FormValidator === 'undefined') {
        console.error('Required utility managers not loaded');
        return false;
    }

    loader = new LoadingManager();
    errorMgr = new ErrorManager();
    validator = new FormValidator();

    return true;
}

function setupFormValidation() {
    // Setup form validation rules
    validator.addRules({
        firstName: [
            { type: 'required' },
            { type: 'minLength', value: 2, message: 'First name must be at least 2 characters' }
        ],
        lastName: [
            { type: 'required' },
            { type: 'minLength', value: 2, message: 'Last name must be at least 2 characters' }
        ],
        email: [
            { type: 'required' },
            { type: 'email' }
        ],
        phone: [
            { type: 'required' },
            { type: 'phone', message: 'Please enter a valid Kenyan phone number' }
        ],
        nationalId: [
            { type: 'required' },
            { type: 'minLength', value: 5, message: 'National ID must be valid' }
        ],
        password: [
            { type: 'required' },
            { type: 'minLength', value: 8, message: 'Password must be at least 8 characters' }
        ],
        confirmPassword: [
            { type: 'required' }
        ]
    });
}

function setupPasswordRequirements() {
    // Attach password input listener for live requirement feedback
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            const password = e.target.value;

            // Check requirements
            const hasLength = password.length >= 8;
            const hasUpper = /[A-Z]/.test(password);
            const hasLower = /[a-z]/.test(password);
            const hasNumber = /\d/.test(password);

            updateRequirement('req-length', hasLength);
            updateRequirement('req-upper', hasUpper);
            updateRequirement('req-lower', hasLower);
            updateRequirement('req-number', hasNumber);
        });
    }
}

/**
 * Safely update a password requirement indicator.
 * Matches the actual HTML structure with .requirement-icon class
 * @param {string} id - The requirement element ID
 * @param {boolean} met - Whether the requirement is met
 */
function updateRequirement(id, met) {
    const element = document.getElementById(id);
    
    // Null safety: check element exists before accessing it
    if (!element) {
        console.warn(`Requirement element with id '${id}' not found`);
        return;
    }

    // Update the class to indicate met/unmet state
    if (met) {
        element.classList.add('met');
    } else {
        element.classList.remove('met');
    }

    // Update the icon/indicator text
    // The HTML structure has: <span class="requirement-icon">○</span>
    const iconElement = element.querySelector('.requirement-icon');
    if (iconElement) {
        iconElement.textContent = met ? '✓' : '○';
    } else {
        console.warn(`Requirement icon not found in element '${id}'`);
    }
}

function setupFormSubmitHandler() {
    if (!form) {
        console.error('Form not initialized for submit handler');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous errors using ErrorManager
        errorMgr.clearAll();

        // Get form values safely
        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');
        const nationalIdInput = document.getElementById('nationalId');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const termsCheckbox = document.getElementById('termsAccepted');

        // Safety check: ensure all required inputs exist
        if (!firstNameInput || !lastNameInput || !emailInput || !phoneInput || !nationalIdInput || !confirmPasswordInput) {
            console.error('One or more form inputs are missing from the DOM');
            errorMgr.show('Form is incomplete. Please refresh and try again.', 'error');
            return;
        }

        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        const nationalId = nationalIdInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validate using FormValidator
        validator.validateField('firstName');
        validator.validateField('lastName');
        validator.validateField('email');
        validator.validateField('phone');
        validator.validateField('nationalId');
        validator.validateField('password');
        validator.validateField('confirmPassword');

        // Check if validation passed
        const allValid = validator.validate();
        if (!allValid) {
            // Errors already displayed by validator
            return;
        }

        // Additional custom validation
        let hasError = false;
        if (password !== confirmPassword) {
            const confirmPasswordInput = document.getElementById('confirmPassword');
            if (confirmPasswordInput) {
                errorMgr.showFieldError(confirmPasswordInput, 'Passwords do not match');
            }
            hasError = true;
        }

        // Validate terms checkbox
        if (!termsCheckbox || !termsCheckbox.checked) {
            const termsCheckboxParent = termsCheckbox ? termsCheckbox.parentElement : null;
            if (termsCheckboxParent) {
                errorMgr.showFieldError(termsCheckbox, 'You must agree to the Terms of Service and Privacy Policy');
            }
            hasError = true;
        }

        if (hasError) {return;}

        try {
            loader.show('Creating your account...');
            form.classList.add('disabled-form');

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `${firstName} ${lastName}`,
                    email,
                    phone,
                    idNumber: nationalId,
                    password
                })
            });

            const data = await response.json();
            loader.hide();

            if (!response.ok) {
                form.classList.remove('disabled-form');

                // Handle validation errors array from server
                if (data && Array.isArray(data.errors) && data.errors.length > 0) {
                    // Show each field error if we can map it
                    data.errors.forEach(err => {
                        const field = err.param || err.field || null;
                        const msg = err.msg || err.message || data.message || 'Invalid input';
                        if (field) {
                            const fieldEl = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
                            if (fieldEl) {
                                errorMgr.showFieldError(fieldEl, msg);
                                return;
                            }
                        }
                        // Fallback to general error
                        errorMgr.show(msg, 'error', 5000);
                    });
                } else {
                    const userMessage = data && (data.message || data.error) || 'Registration failed. Please try again.';
                    errorMgr.show(userMessage, 'error', 4000);
                }
                return;
            }

            // Success - Account registered, needs email verification
            // ONLY show success AFTER confirming response.ok
            if (successMessage) {
                successMessage.classList.add('show');
            }
            form.reset();
            errorMgr.show('Account created! Redirecting to email verification...', 'success', 2000);
            
            // Reset password requirements display safely
            const requirementElements = document.querySelectorAll('.requirement');
            if (requirementElements && requirementElements.length > 0) {
                requirementElements.forEach(req => {
                    req.classList.remove('met');
                    const iconElement = req.querySelector('.requirement-icon');
                    if (iconElement) {
                        iconElement.textContent = '○';
                    }
                });
            }

            // Store email for verification page
            if (data.landlord && data.landlord.email) {
                localStorage.setItem('landlordEmail', data.landlord.email);
            }

            // Redirect to verification pending page
            setTimeout(() => {
                const redirectEmail = data.landlord && data.landlord.email ? data.landlord.email : email;
                window.location.href = `/verify-email-pending?email=${encodeURIComponent(redirectEmail)}`;
            }, 1500);
        } catch (error) {
            loader.hide();
            form.classList.remove('disabled-form');
            console.error('Registration error:', error);
            errorMgr.handleApiError(error);
        }
    });
}

/**
 * Initialize the registration form when DOM is fully loaded.
 * This ensures all elements exist before we try to access them.
 */
function initializeRegistrationForm() {
    // Initialize DOM elements
    if (!initializeDOMElements()) {
        console.error('Failed to initialize registration form: DOM elements missing');
        return;
    }

    // Setup form validation rules
    setupFormValidation();

    // Setup password requirement listeners
    setupPasswordRequirements();

    // Setup form submit handler
    setupFormSubmitHandler();

    console.log('Registration form initialized successfully');
}

// Ensure initialization happens after DOM is fully loaded
if (document.readyState === 'loading') {
    // DOM still loading, wait for DOMContentLoaded event
    document.addEventListener('DOMContentLoaded', initializeRegistrationForm);
} else {
    // DOM already loaded, initialize immediately
    initializeRegistrationForm();
}
