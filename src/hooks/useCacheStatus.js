import { useCallback, useSyncExternalStore } from 'react';
import {
  NO_CACHE_STATUS,
  getCacheStatus,
  getLatestCacheStatus,
  subscribeCacheStatus,
} from '../services/cacheStatusStore.js';

/**
 * Whether the data currently on screen came from the service worker's cache.
 * Without a URL it reports the most recent answer the app received.
 */
export function useCacheStatus(url) {
  const getSnapshot = useCallback(
    () => (url ? getCacheStatus(url) : getLatestCacheStatus()),
    [url],
  );
  return useSyncExternalStore(subscribeCacheStatus, getSnapshot, () => NO_CACHE_STATUS);
}
