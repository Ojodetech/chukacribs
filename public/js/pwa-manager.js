/**
 * PWA Initialization & Management
 * Handles service worker registration, install prompts, and offline features
 */

class PWAManager {
  constructor() {
    this.swRegistration = null;
    this.deferredPrompt = null;
    this.isOnline = navigator.onLine;
    this.init();
  }

  /**
   * Initialize PWA features
   */
  init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => this.registerServiceWorker());
    }

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Install prompt handling
    window.addEventListener('beforeinstallprompt', (e) => this.handleBeforeInstallPrompt(e));
    window.addEventListener('appinstalled', () => this.handleAppInstalled());

    // Prevent default context menu on long press for better mobile UX
    document.addEventListener('contextmenu', (e) => {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'A') {
        e.preventDefault();
      }
    });

    // Initialize offline detection
    this.initOfflineDetection();
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      this.swRegistration = registration;
      console.log('Service Worker registered successfully');

      // Check for updates
      registration.addEventListener('updatefound', () => this.handleUpdate(registration));

      // Update service worker periodically
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  /**
   * Handle service worker updates
   */
  handleUpdate(registration) {
    const newWorker = registration.installing;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker available
        this.showUpdateNotification();
      }
    });
  }

  /**
   * Show update notification
   */
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'pwa-notification pwa-update';
    notification.innerHTML = `
      <div class="pwa-notification-content">
        <p>A new version of ChukaCribs is available!</p>
        <button class="pwa-update-btn">Update Now</button>
      </div>
    `;

    document.body.appendChild(notification);

    notification.querySelector('.pwa-update-btn').addEventListener('click', () => {
      window.location.reload();
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      notification.remove();
    }, 10000);
  }

  /**
   * Handle before install prompt
   */
  handleBeforeInstallPrompt(event) {
    // Prevent the mini-infobar from appearing on mobile
    event.preventDefault();
    // Store the event for later use
    this.deferredPrompt = event;

    // Show install prompt if not previously dismissed
    if (!this.wasInstallPromptDismissed()) {
      this.showInstallPrompt();
    }
  }

  /**
   * Show install prompt
   */
  showInstallPrompt() {
    const promptDiv = document.createElement('div');
    promptDiv.className = 'pwa-install-prompt';
    promptDiv.innerHTML = `
      <div class="pwa-prompt-content">
        <div class="pwa-prompt-icon">📱</div>
        <div class="pwa-prompt-text">
          <h3>Install ChukaCribs</h3>
          <p>Add to your home screen for quick access</p>
        </div>
        <button class="pwa-install-btn">Install</button>
        <button class="pwa-dismiss-btn">Maybe Later</button>
      </div>
    `;

    document.body.appendChild(promptDiv);

    promptDiv.querySelector('.pwa-install-btn').addEventListener('click', () => {
      this.promptInstall();
    });

    promptDiv.querySelector('.pwa-dismiss-btn').addEventListener('click', () => {
      promptDiv.remove();
      this.setInstallPromptDismissed();
    });

    // Auto-hide after 30 seconds
    setTimeout(() => {
      if (promptDiv.parentNode) {
        promptDiv.remove();
      }
    }, 30000);
  }

  /**
   * Trigger install prompt
   */
  async promptInstall() {
    if (!this.deferredPrompt) {return;}

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('App installed');
      this.setInstallPromptDismissed();
    } else {
      console.log('App installation dismissed');
    }

    this.deferredPrompt = null;
  }

  /**
   * Handle app installed event
   */
  handleAppInstalled() {
    console.log('ChukaCribs has been installed!');
    this.deferredPrompt = null;
    
    // Show celebration notification
    this.showNotification('Welcome!', {
      body: 'ChukaCribs has been successfully installed',
      icon: '/images/icon-192x192.png',
      badge: '/images/icon-192x192.png',
      tag: 'pwa-installed'
    });
  }

  /**
   * Handle online event
   */
  handleOnline() {
    this.isOnline = true;
    console.log('Back online');
    this.removeOfflineIndicator();
    
    // Trigger sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.sync.register('sync-data');
        registration.sync.register('sync-bookings');
      });
    }
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    this.isOnline = false;
    console.log('Offline');
    this.showOfflineIndicator();
  }

  /**
   * Show offline indicator
   */
  showOfflineIndicator() {
    let indicator = document.getElementById('offline-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-indicator';
      indicator.className = 'offline-indicator';
      indicator.innerHTML = '📡 You are offline - changes will sync when back online';
      document.body.appendChild(indicator);
    }

    indicator.classList.remove('hidden');
  }

  /**
   * Remove offline indicator
   */
  removeOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.classList.add('hidden');
    }
  }

  /**
   * Initialize offline detection
   */
  initOfflineDetection() {
    if (!this.isOnline) {
      this.showOfflineIndicator();
    }
  }

  /**
   * Show notification
   */
  async showNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      if (this.swRegistration) {
        await this.swRegistration.showNotification(title, options);
      }
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Notification permission error:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Check if install prompt was dismissed
   */
  wasInstallPromptDismissed() {
    return localStorage.getItem('pwa-install-dismissed') === 'true';
  }

  /**
   * Mark install prompt as dismissed
   */
  setInstallPromptDismissed() {
    localStorage.setItem('pwa-install-dismissed', 'true');
  }

  /**
   * Get PWA status
   */
  getStatus() {
    return {
      installed: window.matchMedia('(display-mode: standalone)').matches,
      online: this.isOnline,
      swRegistered: this.swRegistration !== null
    };
  }

  /**
   * Force update check
   */
  async checkForUpdates() {
    if (this.swRegistration) {
      await this.swRegistration.update();
    }
  }
}

// Initialize PWA on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
  });
} else {
  window.pwaManager = new PWAManager();
}

// Add PWA styles
const style = document.createElement('style');
style.textContent = `
  .pwa-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    padding: 16px;
    max-width: 350px;
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
  }

  @media (max-width: 480px) {
    .pwa-notification {
      top: 10px;
      right: 10px;
      left: 10px;
      max-width: none;
    }
  }

  .pwa-notification-content {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .pwa-update-btn {
    background: #6366f1;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }

  .pwa-install-prompt {
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    padding: 16px;
    z-index: 9998;
    animation: slideUp 0.3s ease-out;
    max-width: 500px;
  }

  @media (max-width: 480px) {
    .pwa-install-prompt {
      bottom: 10px;
      left: 10px;
      right: 10px;
    }
  }

  .pwa-prompt-content {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .pwa-prompt-icon {
    font-size: 2rem;
  }

  .pwa-prompt-text {
    flex: 1;
  }

  .pwa-prompt-text h3 {
    margin: 0;
    color: #1f2937;
    font-size: 1rem;
  }

  .pwa-prompt-text p {
    margin: 4px 0 0 0;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .pwa-install-btn, .pwa-dismiss-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    white-space: nowrap;
  }

  .pwa-install-btn {
    background: #6366f1;
    color: white;
  }

  .pwa-dismiss-btn {
    background: #e5e7eb;
    color: #1f2937;
  }

  .offline-indicator {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #f59e0b;
    color: white;
    padding: 12px;
    text-align: center;
    font-weight: 600;
    z-index: 9997;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
