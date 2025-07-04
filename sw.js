/*
 * ZAININ AI - Service Worker
 * Version: 1.4 - Comprehensive PWA Cache
 * Description: Handles caching of the core application shell for offline functionality,
 * ensuring a reliable experience even without a network connection for cached assets.
 */

// Define the name for our cache. Update this version number whenever you change
// the list of files to cache or the caching strategy.
const CACHE_NAME = 'zainin-ai-cache-v5';

// List all the files that constitute the "app shell". These are the essential
// assets (HTML, CSS, JS, critical images/fonts) required for the application
// to load and function in a basic state.
const URLS_TO_CACHE = [
  '/', // The root path
  '/index.html',
  '/api.html',
  '/profile.html',
  '/privacyPolicy.html',
  '/termsConditions.html',
  '/offline.html', // Custom offline page
  '/manifest.json', // The web app manifest
  '/style.css',
  '/theme.js', // Global theme script
  '/firebase-config.js', // Firebase config (needed by other scripts)
  '/script.js', // Main app logic
  '/api.js', // API page logic
  '/profile.js', // Profile page logic
  // --- Assets ---
  '/assets/logo.jpg', // App logo
  '/assets/typing.gif', // Typing indicator GIF
  // --- Icons (list all sizes used in manifest and HTML) ---
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-128x128.png',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-152x152.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-384x384.png', // Added 384x384 based on standard recommendations
  '/assets/icons/icon-512x512.png',
  // If you add shortcut icons to the manifest, list them here:
  // '/assets/icons/shortcut-new-chat-96x96.png',
  // If you use a local tutorial video, cache it:
  // '/assets/videos/tutorial.mp4',

  // --- External Resources (CDNs) ---
  // Caching strategies for CDNs can vary. Cache-first is used here.
  // Ensure these URLs are exact, including query parameters if any.
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  // Firebase SDKs - list the specific versions and modules used
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js'
];

/**
 * INSTALLATION Event:
 * This event occurs when the service worker is initially installed or updated.
 * It's primarily used to open a cache and populate it with the app shell files.
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install (v1.4)');
  // event.waitUntil ensures the service worker doesn't install until the promise resolves.
  event.waitUntil(
    // Open the cache defined by CACHE_NAME
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell...');
        // Add all URLs from the list to the cache.
        // cache.addAll is atomic; if any file fails, the entire cache operation fails.
        // Using Request objects with { mode: 'no-cors' } is often necessary for
        // cross-origin assets (like CDNs) to prevent errors, even though the
        // resulting cached responses are 'opaque' (you can't inspect them).
        return cache.addAll(URLS_TO_CACHE.map(url => new Request(url, { mode: (url.startsWith('http:') || url.startsWith('https:')) ? 'no-cors' : 'cors' })))
          .then(() => {
            console.log('[Service Worker] App shell caching complete.');
            // Force the waiting service worker to become the active service worker
            // This is useful during development/updates so you don't have to close all tabs.
            self.skipWaiting();
          })
          .catch(error => {
            console.error('[Service Worker] Failed to cache some app shell resources:', error);
            // If caching fails for essential files, you might want to make the installation fail.
            // For this example, we log the error but let the install proceed,
            // assuming core files might still be cached from previous versions.
            // throw error; // Uncomment to fail installation on any cache error
          });
      })
      .catch(error => {
        console.error('[Service Worker] Service Worker installation failed:', error);
        // Log installation failure
      })
  );
});

/**
 * ACTIVATION Event:
 * This event fires after the service worker has been successfully installed
 * and any previous version has been deactivated. It's ideal for cleaning up
 * old caches.
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate (v1.4)');
  // event.waitUntil ensures activation doesn't complete until the promise resolves.
  event.waitUntil(
    // Get the names of all currently existing caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        // Iterate through all cache names
        cacheNames.map((cache) => {
          // If a cache name is NOT the current CACHE_NAME, delete it
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
        console.log('[Service Worker] Old caches cleared.');
        // Tell the active service worker to take control of all clients (pages)
        // under its scope immediately.
        return self.clients.claim();
    })
  );
});

/**
 * FETCH Event:
 * This is the core of the service worker. It intercepts every network request
 * made by the application. We use a caching strategy here.
 *
 * Strategy: Cache First for App Shell, Network Only for Others, Offline Page Fallback
 * - For requests that match a URL in our `URLS_TO_CACHE` list (the app shell),
 *   we try to serve the response from the cache *first*. If it's not in the
 *   cache, we go to the network and cache a successful response for future use.
 * - For requests that are NOT in our app shell list (e.g., dynamic data from
 *   Firebase, API calls, etc.), we always go to the network. These are not
 *   cached by the service worker because they are dynamic or require online connectivity.
 * - If a 'navigate' request (a request for an HTML page like `/`, `/index.html`, etc.)
 *   fails (because network is down or the resource isn't in the cache), we serve
 *   the `/offline.html` page from the cache as a fallback.
 */
self.addEventListener('fetch', (event) => {
  // Only handle GET requests, as POST, PUT, etc., typically modify data and
  // shouldn't be served from a static cache.
  if (event.request.method !== 'GET') {
    return; // Let non-GET requests bypass the service worker cache
  }

  // Parse the requested URL
  const requestUrl = new URL(event.request.url);

  // Check if the request is for an asset that is part of our defined app shell.
  // This check needs to handle both same-origin (pathname) and cross-origin (full URL) assets.
  const isAppShellAsset = URLS_TO_CACHE.some(cachedUrl => {
      const cachedUrlObj = new URL(cachedUrl, self.location.origin);
      if (cachedUrlObj.origin === requestUrl.origin) {
          // For same-origin assets, compare only the pathname
          return cachedUrlObj.pathname === requestUrl.pathname;
      }
      // For cross-origin assets (CDNs), compare the full URL string
      return cachedUrl === event.request.url;
  });


  if (isAppShellAsset) {
      // If the request is for an app shell asset:
      console.log('[Service Worker] Fetching app shell asset (Cache First):', event.request.url);

       // Use the Cache First strategy:
       event.respondWith(
           caches.match(event.request) // Try to find the request in the cache
               .then(cachedResponse => {
                   if (cachedResponse) {
                       // If found in cache, return the cached response immediately
                       console.log('[Service Worker] Serving from cache:', event.request.url);
                       return cachedResponse;
                   }

                   // If not found in cache, fetch from the network
                   console.log('[Service Worker] Not in cache, fetching from network:', event.request.url);
                   return fetch(event.request)
                       .then(networkResponse => {
                           // Check if we received a valid response from the network.
                           // A valid response means we can potentially cache it.
                           // We don't cache non-200 responses (like 404s).
                           // For 'no-cors' requests (CDNs), the type is 'opaque', status might be 0.
                           // We generally cache successful opaque responses too.
                           const shouldCache = networkResponse &&
                               (networkResponse.status === 200 || networkResponse.type === 'opaque');

                           if (shouldCache) {
                               // Clone the response before caching because the original response
                               // is consumed when returned to the browser.
                               const responseToCache = networkResponse.clone();
                               // Open the cache and store the network response
                               caches.open(CACHE_NAME).then(cache => {
                                   console.log('[Service Worker] Caching fetched asset:', event.request.url);
                                   cache.put(event.request, responseToCache);
                               });
                           } else {
                              console.warn(`[Service Worker] Not caching response for ${event.request.url}: Status ${networkResponse?.status}, Type ${networkResponse?.type}`);
                           }

                           // Return the original network response to the browser
                           return networkResponse;
                       })
                       .catch(error => {
                           // If the network request fails (e.g., offline) and it wasn't in the cache:
                           console.error('[Service Worker] Network fetch failed for app shell asset:', event.request.url, error);
                           // If the failed request was a navigation request (for an HTML page),
                           // serve the offline fallback page from the cache.
                           if (event.request.mode === 'navigate') {
                               console.log('[Service Worker] Navigation failed, serving offline page.');
                               return caches.match('/offline.html')
                                    .then(offlineResponse => {
                                         // Ensure we return *something*, even if offline.html isn't cached (though it should be)
                                        return offlineResponse || new Response("Offline - Check your connection", { status: 503, statusText: "Service Unavailable" });
                                    });
                           }
                           // For other asset types (CSS, JS, images) not found in cache or network,
                           // let the error propagate. The browser will report a network error.
                           throw error; // Re-throw the error
                       });
               })
               .catch(cacheError => {
                   // This catch block handles errors that occur during the caches.match() operation (rare)
                   console.error('[Service Worker] Cache match failed:', event.request.url, cacheError);
                   // As a fallback, try fetching from the network if cache matching fails
                   return fetch(event.request); // This fetch might also fail and be caught by its own .catch
               })
       );
       return; // Stop processing after handling app shell assets

  } else {
      // If the request is NOT for an app shell asset (e.g., Firebase Firestore/Auth, OpenRouter API, SerpApi Proxy):
      console.log('[Service Worker] Fetching non-app shell asset (Network Only):', event.request.url);
      // Use the Network Only strategy:
      event.respondWith(
        fetch(event.request) // Go directly to the network
          .catch((error) => {
            // If the network request fails for a non-app shell asset:
            console.error('[Service Worker] Network fetch failed for non-app shell asset:', event.request.url, error);
            // These requests require a network connection (like saving data, getting AI responses).
            // We don't provide offline fallbacks for these dynamic operations.
            // If the failed request was a navigation request (unlikely for non-app-shell, but defensive),
            // serve the offline page.
            if (event.request.mode === 'navigate') {
                 console.log('[Service Worker] Non-app shell navigation failed, serving offline page.');
                 return caches.match('/offline.html')
                    .then(offlineResponse => {
                       return offlineResponse || new Response("Offline - Check your connection", { status: 503, statusText: "Service Unavailable" });
                   });
            }
            // For other non-navigation requests, just let the error propagate to the page script.
             throw error; // Re-throw the error so the application knows the operation failed
          })
      );
      return; // Stop processing
  }
});