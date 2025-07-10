// Service Worker for ePick PWA
const CACHE_NAME = 'epick-v1.0.0';
const STATIC_CACHE_NAME = 'epick-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'epick-dynamic-v1.0.0';

// Static assets to cache
const STATIC_ASSETS = [
    '/',
    '/static/stylesheets/common/main.css',
    '/static/stylesheets/common/mobile-responsive.css',
    '/static/stylesheets/common/restricted/main.css',
    '/static/stylesheets/common/restricted/navbar.css',
    '/static/stylesheets/common/restricted/sidebar.css',
    '/static/stylesheets/common/announcements.css',
    '/static/scripts/common/main.js',
    '/static/scripts/common/api.js',
    '/static/scripts/common/restricted/main.js',
    '/static/scripts/common/restricted/navbar.js',
    '/static/scripts/common/restricted/sidebar.js',
    '/static/scripts/common/mobileTableHandler.js',
    '/static/scripts/common/announcementManager.js',
    '/static/media/logos/primary-logo.svg',
    '/static/media/logos/primary-logo.png',
    '/static/media/logos/favico.png',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Pre-caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker: Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Clearing old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip external requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // Skip API requests (let them go to network)
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Cache strategy: Cache First for static assets, Network First for pages
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset))) {
        event.respondWith(cacheFirst(request));
    } else {
        event.respondWith(networkFirst(request));
    }
});

// Cache First strategy
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Cache first failed:', error);
        return new Response('Offline', { status: 503 });
    }
}

// Network First strategy
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache:', error);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (request.destination === 'document') {
            return caches.match('/offline.html') || new Response('Offline', { status: 503 });
        }
        
        return new Response('Offline', { status: 503 });
    }
}

// Push event - handle push notifications
self.addEventListener('push', event => {
    console.log('Service Worker: Push notification received');
    
    let notificationData = {
        title: 'ePick Notification',
        body: 'You have a new notification',
        icon: '/static/media/logos/primary-logo-192.png',
        badge: '/static/media/logos/primary-logo-96.png',
        tag: 'epick-notification',
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
        data: {
            url: '/restricted/dashboard'
        }
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                ...notificationData,
                ...data,
                data: {
                    url: data.url || '/restricted/dashboard',
                    notificationId: data.notificationId,
                    ...data.data
                }
            };
        } catch (error) {
            console.error('Service Worker: Failed to parse push data:', error);
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification clicked');
    
    const notification = event.notification;
    const data = notification.data || {};
    
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.focus();
                        if (data.url) {
                            client.navigate(data.url);
                        }
                        return;
                    }
                }
                
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(data.url || '/restricted/dashboard');
                }
            })
    );
});

// Background sync event
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync triggered');
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

// Background sync function
async function doBackgroundSync() {
    try {
        // Perform background sync tasks
        console.log('Service Worker: Performing background sync');
        
        // Example: Sync offline data
        const offlineData = await getOfflineData();
        if (offlineData.length > 0) {
            await syncOfflineData(offlineData);
        }
        
        // Example: Refresh critical data
        await refreshCriticalData();
        
    } catch (error) {
        console.error('Service Worker: Background sync failed:', error);
    }
}

// Helper functions for background sync
async function getOfflineData() {
    try {
        const cache = await caches.open('offline-data');
        const keys = await cache.keys();
        return keys.filter(key => key.url.includes('offline-data'));
    } catch (error) {
        console.error('Service Worker: Failed to get offline data:', error);
        return [];
    }
}

async function syncOfflineData(data) {
    console.log('Service Worker: Syncing offline data:', data);
    // Implement offline data sync logic
}

async function refreshCriticalData() {
    console.log('Service Worker: Refreshing critical data');
    // Implement critical data refresh logic
}

// Error handling
self.addEventListener('error', event => {
    console.error('Service Worker: Error occurred:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker: Unhandled promise rejection:', event.reason);
});

// Message handling from clients
self.addEventListener('message', event => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
        case 'CACHE_URLS':
            event.waitUntil(cacheUrls(data.urls));
            break;
        case 'CLEAR_CACHE':
            event.waitUntil(clearCache(data.cacheName));
            break;
        default:
            console.log('Service Worker: Unknown message type:', type);
    }
});

// Helper functions for message handling
async function cacheUrls(urls) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        await cache.addAll(urls);
        console.log('Service Worker: URLs cached successfully');
    } catch (error) {
        console.error('Service Worker: Failed to cache URLs:', error);
    }
}

async function clearCache(cacheName) {
    try {
        const deleted = await caches.delete(cacheName);
        console.log('Service Worker: Cache cleared:', cacheName, deleted);
    } catch (error) {
        console.error('Service Worker: Failed to clear cache:', error);
    }
}