import { QueryClient, onlineManager } from '@tanstack/react-query';
import { getConnectivity, subscribeConnectivity } from '../services/connectivityService.js';

// React Query decides "are we online?" from navigator.onLine, which lies on
// captive portals and dead uplinks. Point it at the probe-backed service instead:
// queries then pause offline rather than burning their retries, and resume on a
// genuine recovery.
onlineManager.setEventListener((setOnline) => {
  setOnline(getConnectivity().isOnline);
  return subscribeConnectivity(() => setOnline(getConnectivity().isOnline));
});

// How long a cached answer is served without asking the API again.
export const STALE_TIME_MS = 60_000;
// How long an unused entry survives in memory before it is garbage collected.
export const GC_TIME_MS = 5 * 60_000;

// 4xx is the server's final word (not found, invalid, conflict) — retrying it
// only wastes a round-trip. 5xx and network blips are worth one more attempt.
function shouldRetry(failureCount, error) {
  if (typeof error?.status === 'number' && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 'online' (the default) would pause every query while offline and the
        // app would hang on a spinner. 'offlineFirst' lets the request go out,
        // where the service worker answers it from the cache; only a genuine
        // miss ends up as an error.
        networkMode: 'offlineFirst',
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        // Revalidation: stale data is refreshed in the background when the user
        // comes back to the tab or the connection returns. Fresh data is not.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      // Changes are written to this browser's overlay, so they work offline too.
      mutations: { retry: 0, networkMode: 'always' },
    },
  });
}
