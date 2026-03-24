/**
 * Form Validator
 * Real-time form validation with user-friendly feedback
 */

class FormValidator {
  constructor(form) {
    this.form = form;
    this.fields = {};
    this.rules = {};
    this.init();
  }

  /**
   * Initialize validator
   */
  init() {
    if (!this.form) {return;}

    // Get all form fields
    const inputs = this.form.querySelectorAll('input, textarea, select');
    inputs.forEach(field => {
      this.fields[field.name] = field;
      
      // Add real-time validation
      field.addEventListener('blur', () => this.validateField(field.name));
      field.addEventListener('change', () => this.validateField(field.name));
      field.addEventListener('input', () => {
        // Clear error on input
        errorManager.clearFieldError(field);
      });
    });
  }

  /**
   * Add validation rule
   * @param {string} fieldName - Field name
   * @param {Object} rules - Validation rules
   */
  addRule(fieldName, rules) {
    this.rules[fieldName] = rules;
  }

  /**
   * Add multiple rules at once
   * @param {Object} rulesMap - Map of field names to rules
   */
  addRules(rulesMap) {
    Object.assign(this.rules, rulesMap);
  }

  /**
   * Validate single field
   * @param {string} fieldName - Field name
   * @returns {boolean}
   */
  validateField(fieldName) {
    const field = this.fields[fieldName];
    if (!field) {return true;}

    const rules = this.rules[fieldName];
    if (!rules) {return true;}

    const value = field.value.trim();
    let error = null;

    // Required
    if (rules.required && !value) {
      error = rules.required === true ? 'This field is required' : rules.required;
    }

    // Min length
    if (!error && rules.minLength && value.length < rules.minLength) {
      error = `Minimum ${rules.minLength} characters required`;
    }

    // Max length
    if (!error && rules.maxLength && value.length > rules.maxLength) {
      error = `Maximum ${rules.maxLength} characters allowed`;
    }

    // Pattern/Regex
    if (!error && rules.pattern && value && !rules.pattern.test(value)) {
      error = rules.patternMessage || 'Invalid format';
    }

    // Email
    if (!error && rules.email && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        error = 'Please enter a valid email address';
      }
    }

    // Phone number
    if (!error && rules.phone && value) {
      const phoneRegex = /^(\+254|254|0)?[71][0-9]{8}$/;
      if (!phoneRegex.test(value.replace(/[-\s]/g, ''))) {
        error = 'Please enter a valid Kenyan phone number';
      }
    }

    // URL
    if (!error && rules.url && value) {
      try {
        new URL(value);
      } catch {
        error = 'Please enter a valid URL';
      }
    }

    // Custom validator
    if (!error && rules.custom && typeof rules.custom === 'function') {
      error = rules.custom(value);
    }

    // Show/hide error
    if (error) {
      errorManager.showFieldError(field, error);
      return false;
    } else {
      errorManager.clearFieldError(field);
      return true;
    }
  }

  /**
   * Validate entire form
   * @returns {boolean}
   */
  validate() {
    let isValid = true;

    Object.keys(this.rules).forEach(fieldName => {
      if (!this.validateField(fieldName)) {
        isValid = false;
      }
    });

    return isValid;
  }

  /**
   * Get form data
   * @returns {Object}
   */
  getData() {
    const data = {};

    Object.entries(this.fields).forEach(([name, field]) => {
      if (field.type === 'checkbox') {
        data[name] = field.checked;
      } else if (field.type === 'radio') {
        if (field.checked) {
          data[name] = field.value;
        }
      } else {
        data[name] = field.value;
      }
    });

    return data;
  }

  /**
   * Reset form
   */
  reset() {
    this.form.reset();
    Object.keys(this.fields).forEach(fieldName => {
      errorManager.clearFieldError(this.fields[fieldName]);
    });
  }

  /**
   * Pre-defined validation rules
   */
  static RULES = {
    required: (fieldName = 'This field') => ({
      required: `${fieldName} is required`
    }),

    email: () => ({
      required: 'Email is required',
      email: true
    }),

    password: () => ({
      required: 'Password is required',
      minLength: 8,
      patternMessage: 'Password must contain uppercase, lowercase, and number'
    }),

    phone: () => ({
      required: 'Phone number is required',
      phone: true
    }),

    name: () => ({
      required: 'Name is required',
      minLength: 2,
      maxLength: 100
    }),

    url: () => ({
      url: true
    })
  };
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormValidator;
}
