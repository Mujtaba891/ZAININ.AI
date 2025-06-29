/*
 * ZAININ AI - Service Worker
 * Version: 1.0
 * Description: Handles caching of the application shell for offline functionality.
 */

const CACHE_NAME = 'zainin-ai-cache-v1';

// List of files that constitute the "app shell" - everything needed for the app to run.
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/firebase-config.js',
  '/manifest.json',
  '/offline.html',
  '/assets/typing.gif',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  '/assets/icons/icon-192x192.png'
];

/**
 * INSTALLATION:
 * This event fires when the service worker is first installed.
 * It opens our cache and adds all the app shell files to it.
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(error => {
        console.error('[Service Worker] Failed to cache app shell:', error);
      })
  );
});

/**
 * ACTIVATION:
 * This event fires after installation. It's a good place to clean up old,
 * unused caches to save space.
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

/**
 * FETCH:
 * This is the most important event. It intercepts every network request made
 * by the application.
 *
 * Strategy: Network Falling Back to Cache
 * 1. Try to fetch the resource from the network. This ensures the user always
 *    gets the freshest data if they are online.
 * 2. If the network request fails (e.g., user is offline), then try to find
 *    the resource in our cache.
 * 3. If a navigation request (for an HTML page) fails and isn't in the cache,
 *    show a custom offline page.
 */
self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If we get a valid response from the network, use it
        // and also update the cache with the new version.
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // If the network request fails, try to get it from the cache.
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              // We found it in the cache!
              return response;
            }

            // For failed navigation requests, show the offline page.
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
          });
      })
  );
});