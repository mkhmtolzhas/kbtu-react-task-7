// The single source of truth shared by three worlds that cannot import each other
// freely: the React app, the hand-written service worker and the Vite build.
//
// `vite.config.js` reads this file in Node and injects it into `src/sw/sw.js` as
// JSON at build time, so the worker and the app can never disagree about a header
// name or a path. Keep this module free of browser APIs.

export const SW_CONTRACT = {
  // Every cache this app owns starts with this prefix; `activate` deletes the rest.
  cachePrefix: 'fleetdesk',

  // Public, read-only catalogue served as static JSON (see scripts/build-api.mjs).
  apiPath: 'api/',
  // One byte of text used to probe the network. Never cached, by anyone.
  pingPath: 'ping.txt',

  // Added by the worker when it answers; read by src/api/http.js.
  servedFromHeader: 'x-served-from',
  cachedAtHeader: 'x-cached-at',

  // Cache budgets. Entries are trimmed by count after every write and swept by
  // age on activation, so an installed app cannot grow without a limit.
  apiMaxEntries: 80,
  apiMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  assetMaxEntries: 60,
  assetMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
};

export const SERVED_FROM_CACHE = 'sw-cache';
export const SERVED_FROM_NETWORK = 'network';
