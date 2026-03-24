/**
 * Error Manager
 * Centralized error handling and user-friendly messages
 */

class ErrorManager {
  constructor() {
    this.errorContainer = null;
    this.init();
  }

  /**
   * Initialize error container
   */
  init() {
    if (!document.getElementById('error-container')) {
      const container = document.createElement('div');
      container.id = 'error-container';
      container.className = 'error-container';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    this.errorContainer = document.getElementById('error-container');
  }

  /**
   * Show error message
   * @param {string} message - Error message
   * @param {string} type - 'error', 'warning', 'info', 'success'
   * @param {number} duration - Auto-hide duration (ms), 0 = manual only
   */
  show(message, type = 'error', duration = 5000) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
      <div class="alert-content">
        <div class="alert-message">${this.escapeHtml(message)}</div>
        <button class="alert-close" aria-label="Close alert">&times;</button>
      </div>
    `;

    this.errorContainer.appendChild(alertDiv);

    // Close button handler
    const closeBtn = alertDiv.querySelector('.alert-close');
    closeBtn.addEventListener('click', () => {
      alertDiv.remove();
    });

    // Auto-hide
    if (duration > 0) {
      setTimeout(() => {
        alertDiv.classList.add('fade-out');
        setTimeout(() => alertDiv.remove(), 300);
      }, duration);
    }

    return alertDiv;
  }

  /**
   * Show error for specific field
   * @param {HTMLElement} field - Form field element
   * @param {string} message - Error message
   */
  showFieldError(field, message) {
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');

    let errorDiv = field.parentElement.querySelector('.field-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      field.parentElement.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
  }

  /**
   * Clear field error
   * @param {HTMLElement} field - Form field element
   */
  clearFieldError(field) {
    field.classList.remove('error');
    field.setAttribute('aria-invalid', 'false');

    const errorDiv = field.parentElement.querySelector('.field-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  /**
   * Clear all errors
   */
  clearAll() {
    this.errorContainer.innerHTML = '';
  }

  /**
   * Handle API errors
   * @param {Error|Object} error - Error object
   */
  handleApiError(error) {
    let message = 'An unexpected error occurred';

    if (error.response) {
      // Server responded with error
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          message = data.message || 'Invalid request. Please check your input.';
          break;
        case 401:
          message = 'Session expired. Please login again.';
          window.location.href = '/login';
          break;
        case 403:
          message = 'You do not have permission to perform this action.';
          break;
        case 404:
          message = 'The requested resource was not found.';
          break;
        case 409:
          message = data.message || 'This action conflicts with existing data.';
          break;
        case 422:
          message = 'Validation failed. Please check your input.';
          break;
        case 429:
          message = 'Too many requests. Please wait a moment and try again.';
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
        case 503:
          message = 'Service temporarily unavailable. Please try again later.';
          break;
        default:
          message = data.message || `Error: ${status}`;
      }
    } else if (error.request) {
      // Request made but no response
      message = 'Network error. Please check your connection.';
    } else if (error.message) {
      message = error.message;
    }

    this.show(message, 'error');
    return message;
  }

  /**
   * Handle form validation errors
   * @param {Object} errors - Object with field names and error messages
   * @param {HTMLElement} form - Form element
   */
  handleValidationErrors(errors, form) {
    this.clearAll();

    Object.entries(errors).forEach(([fieldName, errorMessage]) => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        this.showFieldError(field, errorMessage);
      }
    });
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Log error to console (development only)
   * @param {Error} error - Error object
   */
  logError(error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status
      });
    }
  }

  /**
   * Show styled confirmation modal for success messages
   * @param {string} title - Modal title
   * @param {Array} details - Array of detail lines or HTML content
   * @param {Function} onConfirm - Callback when user confirms
   */
  showConfirmation(title, details = [], onConfirm = null) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'confirmation-modal';
    
    let detailsHtml = '';
    if (Array.isArray(details)) {
      detailsHtml = details.map(detail => `<p>${this.escapeHtml(detail)}</p>`).join('');
    } else {
      detailsHtml = `<p>${this.escapeHtml(details)}</p>`;
    }
    
    modal.innerHTML = `
      <div class="modal-header">
        <h2>${this.escapeHtml(title)}</h2>
      </div>
      <div class="modal-body">
        ${detailsHtml}
      </div>
      <div class="modal-footer">
        <button class="modal-confirm-btn" aria-label="Confirm">OK</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Handle confirm button
    const confirmBtn = modal.querySelector('.modal-confirm-btn');
    const closeModal = () => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 300);
      if (onConfirm) onConfirm();
    };
    
    confirmBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    
    return overlay;
  }
}

// Create global instance
const errorManager = new ErrorManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorManager;
}
