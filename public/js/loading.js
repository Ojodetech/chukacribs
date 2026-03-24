/**
 * Loading Spinner Manager
 * Handles showing/hiding loading states across the application
 */

class LoadingManager {
  constructor() {
    this.loadingCount = 0;
    this.loadingOverlay = null;
    this.init();
  }

  /**
   * Initialize loading overlay
   */
  init() {
    // Create overlay if it doesn't exist
    if (!document.getElementById('loading-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay hidden';
      overlay.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner-circle"></div>
          <div class="loading-text">Loading...</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    this.loadingOverlay = document.getElementById('loading-overlay');
  }

  /**
   * Show loading overlay
   * @param {string} message - Optional loading message
   */
  show(message = 'Loading...') {
    this.loadingCount++;
    if (this.loadingOverlay) {
      const textElement = this.loadingOverlay.querySelector('.loading-text');
      if (textElement) {
        textElement.textContent = message;
      }
      this.loadingOverlay.classList.remove('hidden');
    }
  }

  /**
   * Hide loading overlay
   */
  hide() {
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    if (this.loadingCount === 0 && this.loadingOverlay) {
      this.loadingOverlay.classList.add('hidden');
    }
  }

  /**
   * Reset loading counter and hide
   */
  reset() {
    this.loadingCount = 0;
    this.hide();
  }

  /**
   * Show loading spinner on button
   * @param {HTMLElement} button - Button element
   */
  showButtonLoading(button) {
    if (button) {
      button.disabled = true;
      button.classList.add('loading');
      button.dataset.originalText = button.textContent;
      button.textContent = '';
    }
  }

  /**
   * Hide loading spinner on button
   * @param {HTMLElement} button - Button element
   */
  hideButtonLoading(button) {
    if (button) {
      button.disabled = false;
      button.classList.remove('loading');
      button.textContent = button.dataset.originalText || 'Submit';
    }
  }

  /**
   * Create skeleton loader
   * @param {number} count - Number of skeleton items
   * @param {string} type - 'text', 'avatar', 'card'
   * @returns {HTMLElement}
   */
  createSkeleton(count = 3, type = 'card') {
    const container = document.createElement('div');
    
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = `skeleton skeleton-${type}`;
      container.appendChild(skeleton);
    }
    
    return container;
  }
}

// Create global instance
const loadingManager = new LoadingManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoadingManager;
}
