/**
 * Service Worker
 * Enables offline functionality, caching, and PWA features
 */

const CACHE_NAME = 'chukacribs-v1';
const API_CACHE = 'chukacribs-api-v1';
const IMAGE_CACHE = 'chukacribs-images-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/listings.html',
  '/css/style.css',
  '/css/mobile-optimized.css',
  '/css/loading.css',
  '/css/error-styles.css',
  '/js/app-landing.js',
  '/js/script.js',
  '/js/loading.js',
  '/js/error-manager.js',
  '/js/form-validator.js',
  '/js/image-compressor.js',
  '/js/video-handler.js',
  '/manifest.json'
];

const API_ENDPOINTS = [
  '/api/houses',
  '/api/auth/profile'
];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

// Install event - Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('Cache installation error:', error);
        // Continue even if some assets fail to cache
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== API_CACHE && 
              cacheName !== IMAGE_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Image requests - Cache first
  if (IMAGE_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // HTML and other assets - Cache first, network fallback
  event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
});

/**
 * Network first strategy - Try network, fallback to cache
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Network request failed, trying cache:', request.url);
    const cached = await caches.match(request);
    
    if (cached) {
      return cached;
    }

    // Return offline response for API calls
    if (request.url.includes('/api')) {
      return new Response(
        JSON.stringify({
          error: 'Offline',
          message: 'You are offline. Some features may be limited.',
          timestamp: new Date().toISOString()
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Return offline page
    return caches.match('/index.html');
  }
}

/**
 * Cache first strategy - Try cache, fallback to network
 */
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  
  if (cached) {
    // Update cache in background
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const cache = caches.open(cacheName);
          cache.then(c => c.put(request, response.clone()));
        }
      })
      .catch(() => {
        // Network failed, cache hit is good enough
      });
    
    return cached;
  }

  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    return caches.match('/index.html');
  }
}

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookings') {
    event.waitUntil(syncBookings());
  } else if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Sync pending bookings
async function syncBookings() {
  try {
    const pendingBookings = await getPendingData('bookings');
    
    for (const booking of pendingBookings) {
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking.data)
      });
    }
    
    await clearPendingData('bookings');
  } catch (error) {
    console.error('Booking sync failed:', error);
    throw error;
  }
}

// Sync pending data from IndexedDB
async function syncData() {
  try {
    const pendingData = await getPendingData('all');
    
    for (const item of pendingData) {
      await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data)
      });
    }
    
    await clearPendingData('all');
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

// Get pending data from IndexedDB
async function getPendingData(type = 'all') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chukacribs', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pending'], 'readonly');
      const store = transaction.objectStore('pending');
      
      let query;
      if (type === 'all') {
        query = store.getAll();
      } else {
        query = store.index('type').getAll(type);
      }
      
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    };
  });
}

// Clear pending data from IndexedDB
async function clearPendingData(type = 'all') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chukacribs', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pending'], 'readwrite');
      const store = transaction.objectStore('pending');
      
      let query;
      if (type === 'all') {
        query = store.clear();
      } else {
        query = store.index('type').getAll(type);
        // Delete filtered items
        query.onsuccess = () => {
          const items = query.result;
          items.forEach(item => store.delete(item.id));
        };
        return;
      }
      
      query.onsuccess = () => resolve();
      query.onerror = () => reject(query.error);
    };
  });
}

// Push notification support
self.addEventListener('push', (event) => {
  const data = event.data?.json?.() || {};
  const options = {
    body: data.body || 'ChukaCribs notification',
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-192x192.png',
    tag: data.tag || 'chukacribs',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ChukaCribs', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Check if window is already open
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not found
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// Clear pending data from IndexedDB
async function clearPendingData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chukacribs', 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pending'], 'readwrite');
      const store = transaction.objectStore('pending');
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/images/icon-192x192.png',
    badge: '/images/badge-72x72.png',
    tag: 'notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('ChukaCribs', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if app is already open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open app if not already open
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

console.log('Service Worker registered');
