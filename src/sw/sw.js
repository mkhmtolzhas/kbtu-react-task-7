//
// FleetDesk service worker — written by hand, no Workbox.
//
// Three values are substituted at build time by
// plugins/vite-plugin-service-worker.js: the precache manifest (the hashed build
// output, as paths relative to this file), the version (package version plus a
// hash of that manifest) and the shared contract from src/pwa/swContract.js.
// They are the three capitalised placeholders right below this comment.
//
// Three caches, two lifetimes:
//   fleetdesk-precache-<version>  the app shell. Versioned, replaced on every deploy.
//   fleetdesk-api-v1              public catalogue answers. Survives deploys on purpose:
//   fleetdesk-assets-v1           icons and images.   wiping them would delete the
//                                 user's offline data on every update.

const PRECACHE_MANIFEST = __PRECACHE_MANIFEST__;
const VERSION = '__SW_VERSION__';
const CONTRACT = __SW_CONTRACT__;

const PRECACHE = `${CONTRACT.cachePrefix}-precache-${VERSION}`;
const API_CACHE = `${CONTRACT.cachePrefix}-api-v1`;
const ASSET_CACHE = `${CONTRACT.cachePrefix}-assets-v1`;
const KEEP = new Set([PRECACHE, API_CACHE, ASSET_CACHE]);

// `base: './'` means the app can live in a sub-folder, so everything is resolved
// against the worker's own location instead of the domain root.
const SCOPE_URL = new URL('./', self.location.href);
const SHELL_URL = new URL('index.html', SCOPE_URL).href;
const OFFLINE_URL = new URL('offline.html', SCOPE_URL).href;
const API_PREFIX = new URL(CONTRACT.apiPath, SCOPE_URL).pathname;
const PING_PATH = new URL(CONTRACT.pingPath, SCOPE_URL).pathname;

// Firebase authentication must never be touched: these requests carry credentials
// and drive a popup. The same-origin check below would already skip them; this is
// spelled out so the intent survives the next edit.
const PRIVATE_HOST = /(^|\.)(googleapis\.com|firebaseapp\.com|firebaseio\.com|firebase\.com|gstatic\.com|google\.com)$/;

const ASSET_DESTINATIONS = new Set(['image', 'font', 'style', 'script']);

// Every read from a cache ignores Vary.
//
// Vite marks its script and stylesheet tags `crossorigin`, so the document asks
// for them in CORS mode and sends an `Origin` header, while the worker's own
// precache request did not. Static hosts answer assets with `Vary: Origin`
// (Vite's preview server does), and the default Vary-aware matching then treats
// those as different entries: the precache would silently miss on exactly the
// files the app cannot start without. One URL is one entry here.
const MATCH_OPTIONS = { ignoreVary: true };

// ---------------------------------------------------------------------------
// Install: precache the shell atomically, then warm one API answer.
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    // addAll is all-or-nothing: a broken deploy never half-installs.
    await cache.addAll(PRECACHE_MANIFEST.map((path) => new URL(path, SCOPE_URL).href));

    // Best effort, outside the critical path: one file holds the whole fleet, so
    // warming it makes the very first offline visit show every vehicle.
    try {
      const fleetUrl = new URL(`${CONTRACT.apiPath}fleet.json`, SCOPE_URL).href;
      const response = await fetch(fleetUrl);
      if (response.ok) {
        const apiCache = await caches.open(API_CACHE);
        await apiCache.put(fleetUrl, stamp(response.clone()));
      }
    } catch {
      // Offline during install is fine: the catalogue is fetched again on first use.
    }
  })());
  // Deliberately no skipWaiting() here — the user decides when to switch versions.
});

// ---------------------------------------------------------------------------
// Activate: drop old versions, sweep expired entries, take over open pages.
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(`${CONTRACT.cachePrefix}-`) && !KEEP.has(name))
      .map((name) => caches.delete(name)));

    await sweepAll();
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'SWEEP_CACHES') event.waitUntil(sweepAll());
});

// ---------------------------------------------------------------------------
// Fetch: strategy routing. The order of these rules is the whole design.
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Mutations and Firebase POSTs: never cached, never touched.
  if (request.method !== 'GET') return;

  // 2. Range requests: a 206 cannot be replayed from a cache correctly.
  if (request.headers.has('range')) return;

  const url = new URL(request.url);

  // 3. Authentication and any other third party: hand back to the browser without
  //    respondWith(), which keeps credentials and the popup's opener intact.
  if (PRIVATE_HOST.test(url.hostname)) return;

  // 4. Anything else cross-origin: browser default.
  if (url.origin !== self.location.origin) return;

  // 5. The connectivity probe only means something if it really hits the network.
  if (url.pathname === PING_PATH) return;

  // 6. Page navigations: the shell, or the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate());
    return;
  }

  // 7. Public catalogue (list + details): stale-while-revalidate.
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(staleWhileRevalidate(event, request));
    return;
  }

  // 8. Static assets: cache-first.
  if (ASSET_DESTINATIONS.has(request.destination) || /\.(png|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event, request));
    return;
  }

  // 9. Everything else same-origin: network, with the cache as a safety net.
  event.respondWith(networkFallingBackToCache(request));
});

/**
 * The app uses hash routing, so every navigation is a request for the same
 * document and the route itself (`#/vehicles/veh-0007`) is never sent to the
 * worker. That one document is precached, so previously visited pages work
 * offline without caching anything per route.
 *
 * Cache-first, not network-first: index.html references hashed JS and CSS, and a
 * new index.html served next to an old precache is a white screen. The shell and
 * its assets move together, and only a new worker version moves them.
 */
async function handleNavigate() {
  const cache = await caches.open(PRECACHE);
  // cache.match(request) would miss: the request is for "/" while the precached
  // key is ".../index.html".
  const shell = await cache.match(SHELL_URL, MATCH_OPTIONS);
  if (shell) return shell;

  try {
    return await fetch(SHELL_URL);
  } catch {
    const offline = await cache.match(OFFLINE_URL, MATCH_OPTIONS);
    return offline ?? new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Stale-while-revalidate for the public API: answer from the cache at once, then
 * refresh it in the background. Offline this degrades to "answer from the cache",
 * which is exactly what makes previously fetched data stay available.
 */
async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request, MATCH_OPTIONS);

  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, stamp(response.clone()));
      event.waitUntil(trimCache(API_CACHE, CONTRACT.apiMaxEntries));
    }
    return response;
  });

  if (cached) {
    // A failed revalidation must never reject the response we already have.
    event.waitUntil(network.catch(() => {}));
    return served(cached, 'sw-cache');
  }

  try {
    return served(await network, 'network');
  } catch {
    // Nothing cached and no network: a JSON 503 the API layer turns into a
    // normal, catchable error instead of an exception in the page.
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      statusText: 'Offline',
      headers: {
        'Content-Type': 'application/json',
        [CONTRACT.servedFromHeader]: 'none',
      },
    });
  }
}

/**
 * Cache-first for scripts, styles, icons, images and fonts: they never change
 * without a new URL, so a hit is always correct and always instant.
 *
 * Nothing here is rebuilt or stamped. A `new Response(...)` loses the response's
 * URL, and a JavaScript module whose response has no URL cannot resolve its own
 * relative imports — the lazily loaded pages would fail to load offline with a
 * misleading "failed to fetch dynamically imported module". Their age comes from
 * the server's own `Date` header instead.
 */
async function cacheFirst(event, request) {
  const precached = await caches.match(request, { ...MATCH_OPTIONS, cacheName: PRECACHE });
  if (precached) return precached;

  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request, MATCH_OPTIONS);
  if (cached) return cached;

  const response = await fetch(request);
  // Opaque responses have a null body and nothing useful to store.
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
    event.waitUntil(trimCache(ASSET_CACHE, CONTRACT.assetMaxEntries));
  }
  return response;
}

async function networkFallingBackToCache(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request, MATCH_OPTIONS);
    if (cached) return cached;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Response stamping. Cached responses are immutable, so a header can only be
// added by rebuilding the response around the same body — which also drops the
// response's URL. Only the JSON answers of the catalogue are stamped: they are
// read by the application, never by the module loader.
// ---------------------------------------------------------------------------

/** Records when these bytes came off the network. Used at put() time. */
function stamp(response) {
  const headers = new Headers(response.headers);
  headers.set(CONTRACT.cachedAtHeader, new Date().toISOString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Says where the bytes came from. Used at serve time; the app reads this. */
function served(response, origin) {
  const headers = new Headers(response.headers);
  headers.set(CONTRACT.servedFromHeader, origin);
  if (!headers.has(CONTRACT.cachedAtHeader)) {
    headers.set(CONTRACT.cachedAtHeader, new Date().toISOString());
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Cache size control: a count cap after every write, an age sweep on activation.
// ---------------------------------------------------------------------------

/**
 * cache.keys() resolves in insertion order, and put() moves a refreshed entry to
 * the back — so trimming from the front is FIFO that behaves like LRU for
 * anything the user keeps visiting.
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

function isExpired(response, maxAgeMs) {
  // Stamped entries carry their own header; unstamped ones (assets) fall back to
  // the server's Date. An entry of unknown age is kept: stale data still beats a
  // blank screen.
  const stored = response?.headers.get(CONTRACT.cachedAtHeader) ?? response?.headers.get('date') ?? '';
  const cachedAt = Date.parse(stored);
  return Number.isNaN(cachedAt) ? false : Date.now() - cachedAt > maxAgeMs;
}

async function sweepExpired(cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  for (const key of await cache.keys()) {
    const response = await cache.match(key, MATCH_OPTIONS);
    if (isExpired(response, maxAgeMs)) await cache.delete(key);
  }
}

async function sweepAll() {
  await sweepExpired(API_CACHE, CONTRACT.apiMaxAgeMs);
  await sweepExpired(ASSET_CACHE, CONTRACT.assetMaxAgeMs);
}
