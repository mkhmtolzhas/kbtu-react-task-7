import { SERVED_FROM_CACHE } from '../pwa/swContract.js';

// Where the last answer for a URL came from, so the UI can tell the user they are
// looking at saved data. Written by src/api/http.js, read through
// src/hooks/useCacheStatus.js with useSyncExternalStore.
//
// A plain external store (not React state) because the fetch layer must stay
// usable outside React — and because the snapshots have to be referentially
// stable for useSyncExternalStore to avoid an infinite render loop.

export const NO_CACHE_STATUS = Object.freeze({
  fromCache: false,
  cachedAt: null,
  url: null,
});

const listeners = new Set();
const byUrl = new Map();
let latest = NO_CACHE_STATUS;

function emit() {
  for (const listener of listeners) listener();
}

export function recordCacheMeta(url, { servedFrom, cachedAt }) {
  const status = Object.freeze({
    fromCache: servedFrom === SERVED_FROM_CACHE,
    cachedAt: cachedAt ?? null,
    url,
  });

  const previous = byUrl.get(url);
  const unchanged = previous
    && previous.fromCache === status.fromCache
    && previous.cachedAt === status.cachedAt;

  byUrl.set(url, unchanged ? previous : status);
  const next = unchanged ? previous : status;

  // `latest` drives the app-wide banner: it always reflects the most recent
  // successful read, whichever screen made it.
  if (latest !== next) {
    latest = next;
    emit();
  }
}

export function subscribeCacheStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCacheStatus(url) {
  return byUrl.get(url) ?? NO_CACHE_STATUS;
}

export function getLatestCacheStatus() {
  return latest;
}
