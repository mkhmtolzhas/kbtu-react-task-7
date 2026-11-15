import { setUpdateReady } from './swUpdateStore.js';

// How often an open tab asks whether a new version was deployed.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Module scope, not component state: StrictMode mounts twice, and two reloads
// racing each other is the classic service-worker reload loop.
let reloading = false;
let registered = false;

/**
 * Registers the worker and wires the update prompt.
 *
 * The new version is never activated behind the user's back: a fresh worker waits
 * until they press "Update now", because swapping the controller under a running
 * tab leaves that tab asking the new cache for the old, already deleted chunks.
 */
export function registerServiceWorker() {
  if (registered) return;
  if (!('serviceWorker' in navigator)) return;
  // No worker in development: there is no precache manifest before a build, and a
  // caching worker and HMR cannot both be right.
  if (!import.meta.env.PROD) return;

  registered = true;

  // Resolved against the document, not import.meta.url: bundles live in assets/,
  // while the worker has to sit at the root of the scope it controls.
  const swUrl = new URL('sw.js', document.baseURI).href;
  const scope = new URL('./', document.baseURI).href;

  // Captured before registering: on a first-ever install, clients.claim() also
  // fires controllerchange, and reloading then would reload every first visit.
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.register(swUrl, { scope, updateViaCache: 'none' })
    .then((registration) => {
      const announce = () => setUpdateReady(() => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });

      // A version may already be waiting from a previous visit.
      if (registration.waiting && navigator.serviceWorker.controller) announce();

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          // "installed" while a controller exists means: a new version is parked
          // in `waiting`. Without a controller it is simply the first install.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) announce();
        });
      });

      // Housekeeping for long-lived installed apps.
      navigator.serviceWorker.controller?.postMessage({ type: 'SWEEP_CACHES' });

      setInterval(() => { registration.update(); }, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
    })
    .catch(() => {
      // A failed registration must never break the application.
    });
}
