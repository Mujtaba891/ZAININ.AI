/*
 * ZAININ AI - Service Worker
 * Version: 1.3 - Profile Update Functionality
 * Description: Handles caching of the application shell for offline functionality,
 * including the profile page with update capabilities.
 */

const CACHE_NAME = 'zainin-ai-cache-v4'; // Updated cache name

// List of files that constitute the "app shell" - everything needed for the app to run.
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/api.html',
  '/profile.html', // Added
  '/privacyPolicy.html', // Added
  '/termsConditions.html', // Added
  '/style.css',
  '/script.js',
  '/api.js',
  '/profile.js', // Added
  '/theme.js', // Added
  '/firebase-config.js',
  '/manifest.json',
  '/offline.html',
  '/assets/typing.gif',
  '/assets/logo.jpg', // Added logo
  // Include essential icons (list all sizes used)
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-128x128.png',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-152x152.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  // If you use a local video for the tutorial, add its path here:
  // '/assets/videos/api_tutorial.mp4',
];

/**
 * INSTALLATION:
 * This event fires when the service worker is first installed.
 * It opens our cache and adds all the app shell files to it.
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install (v1.3)');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell...');
        // Use cache.addAll to add all critical assets.
        // Note: cache.addAll fails if *any* resource fails to fetch.
        // A more robust approach might fetch and add items one by one, logging failures.
        // Added 'no-cors' mode for CDN assets, though this results in 'opaque' responses
        // which can't be inspected but can still be cached and served.
        return cache.addAll(URLS_TO_CACHE.map(url => new Request(url, { mode: (url.startsWith('http') || url.startsWith('https')) ? 'no-cors' : 'cors' })))
            .catch(error => {
                 console.error('[Service Worker] Failed to cache some app shell resources:', error);
                 // Important: Do NOT reject event.waitUntil here if you want
                 // the service worker to install even if some optional caches fail.
                 // If core files like index.html fail, installation *should* fail.
                 // For now, let's assume core files are fine and log errors for others.
                 // This `catch` prevents the entire install from failing if, say, a font fails.
            });
      })
      .then(() => {
           console.log('[Service Worker] App shell caching complete.');
           // Force the waiting service worker to become the active service worker
           self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Service Worker installation failed:', error);
        // Re-throw the error to fail the installation
        throw error;
      })
  );
});

/**
 * ACTIVATION:
 * This event fires after installation. It's a good place to clean up old,
 * unused caches to save space.
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate (v1.3)');
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
    }).then(() => {
        console.log('[Service Worker] Old caches cleared.');
        // Tell the active service worker to take control of clients
        return self.clients.claim();
    })
  );
});

/**
 * FETCH:
 * This is the most important event. It intercepts every network request made
 * by the application.
 *
 * Strategy: Cache First for App Shell, Network First for Others, Offline Page Fallback
 * - For requests matching the app shell list, try cache first, then network.
 * - For all other requests (Firebase, APIs, etc.), try network first.
 * - If a navigation request (for an HTML page) fails and isn't in the cache,
 *   show the custom offline page.
 */
self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Check if the request is for an asset in our app shell cache
  const isAppShellAsset = URLS_TO_CACHE.some(cachedUrl => {
      // Handle root path correctly and compare full URLs or pathnames
      const cachedUrlObj = new URL(cachedUrl, self.location.origin);
       if (cachedUrlObj.origin === requestUrl.origin) {
           return cachedUrlObj.pathname === requestUrl.pathname;
       }
       // For cross-origin requests (CDNs), compare the full URL
       return cachedUrl === event.request.url;
  });


  if (isAppShellAsset) {
      console.log('[Service Worker] Fetching app shell asset:', event.request.url);
       // Strategy: Cache First, falling back to Network
       event.respondWith(
           caches.match(event.request)
               .then(cachedResponse => {
                   if (cachedResponse) {
                       console.log('[Service Worker] Serving from cache:', event.request.url);
                       return cachedResponse;
                   }

                   // If not in cache, try network and cache the successful response
                   console.log('[Service Worker] Not in cache, fetching from network:', event.request.url);
                   return fetch(event.request).then(networkResponse => {
                       // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200) {
                             // Don't cache non-200 responses. Opaque responses might have status 0/OK, handle as desired.
                             // type === 'opaque' is a good check for no-cors requests.
                            // For this example, we *do* want to cache opaque CDN responses if successful.
                            // If the response is valid but not 200 (e.g., 404), we return it but don't cache it.
                             if (networkResponse.status !== 200) {
                                 console.warn(`[Service Worker] Not caching non-200 response for ${event.request.url}: ${networkResponse.status}`);
                                 return networkResponse;
                             }
                        }

                       // Clone the response before putting it in the cache
                       const responseToCache = networkResponse.clone();
                       caches.open(CACHE_NAME).then(cache => {
                           console.log('[Service Worker] Caching fetched asset:', event.request.url);
                           cache.put(event.request, responseToCache);
                       });

                       return networkResponse; // Return the original network response
                   }).catch(error => {
                       console.error('[Service Worker] Network fetch failed for app shell asset:', event.request.url, error);
                       // If both cache and network fail for a navigation request, serve the offline page
                        if (event.request.mode === 'navigate') {
                            console.log('[Service Worker] Navigation failed, serving offline page.');
                            return caches.match('/offline.html');
                         }
                         // For other asset types (CSS, JS, etc.) just let the browser handle the network error
                         throw error; // Re-throw to signal fetch failure
                   });
               })
               .catch(cacheError => {
                   console.error('[Service Worker] Cache match failed for app shell asset:', event.request.url, cacheError);
                    // If cache matching itself fails (rare), try network and handle as above
                    return fetch(event.request).then(networkResponse => {
                       if (!networkResponse || networkResponse.status !== 200) { return networkResponse; }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => { cache.put(event.request, responseToCache); });
                        return networkResponse;
                    }).catch(networkError => {
                         console.error('[Service Worker] Network fetch failed after cache error:', event.request.url, networkError);
                         if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html');
                         }
                         throw networkError;
                    });
               })
       );
       return; // Stop processing after handling app shell assets

  } else {
      // For requests NOT in our app shell list (like Firebase, API calls, etc.)
      // These requests *cannot* be fulfilled offline by the service worker's cache.
      console.log('[Service Worker] Fetching non-app shell asset (network first):', event.request.url);
      // Strategy: Network Only (or Network First with NO cache fallback)
      event.respondWith(
        fetch(event.request)
          .catch((error) => {
            console.error('[Service Worker] Network fetch failed for non-app shell asset:', event.request.url, error);
            // If a navigation request fails AND it's not in the app shell cache (shouldn't happen
            // if index.html is in app shell, but defensive), serve the offline page.
            // This might catch requests for dynamic routes if your app had them.
            if (event.request.mode === 'navigate') {
                 console.log('[Service Worker] Non-app shell navigation failed, serving offline page.');
                 return caches.match('/offline.html');
            }
            // For other non-app shell assets (API calls, Firebase writes, etc.),
            // the browser will receive a network error. This is the desired behavior
            // as these operations require online connectivity.
             throw error; // Re-throw the error so the application knows it failed
          })
      );
      return; // Stop processing
  }
});